"""Build the final CrisisLens report (.docx) from analysis/output/results.json.

Run after evaluate.py:  python analysis/build_report.py
Output: output/CrisisLens_Final_Report.docx
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

HERE = Path(__file__).parent
ROOT = HERE.parent
OUT = HERE / "output"
FIG = OUT / "figures"
R = json.loads((OUT / "results.json").read_text())
units = pd.read_csv(OUT / "tables" / "units_final.csv")

NAVY = RGBColor(0x10, 0x36, 0x4D)
GREY = RGBColor(0x52, 0x51, 0x4E)

doc = Document()
st = doc.styles["Normal"]
st.font.name = "Calibri"
st.font.size = Pt(11)
for s in ("Heading 1", "Heading 2", "Heading 3"):
    doc.styles[s].font.color.rgb = NAVY
    doc.styles[s].font.name = "Calibri"
for sec in doc.sections:
    sec.left_margin = sec.right_margin = Inches(0.9)
    sec.top_margin = sec.bottom_margin = Inches(0.8)


def P(text="", bold=False, italic=False, size=None, color=None, align=None, space_after=6):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.bold, r.italic = bold, italic
    if size:
        r.font.size = Pt(size)
    if color:
        r.font.color.rgb = color
    if align:
        p.alignment = align
    p.paragraph_format.space_after = Pt(space_after)
    return p


def rich(parts, style=None):
    """parts: list of (text, bold) tuples."""
    p = doc.add_paragraph(style=style)
    for t, b in parts:
        p.add_run(t).bold = b
    p.paragraph_format.space_after = Pt(6)
    return p


def bullet(text, bold_lead=None):
    p = doc.add_paragraph(style="List Bullet")
    if bold_lead:
        p.add_run(bold_lead).bold = True
    p.add_run(text)
    p.paragraph_format.space_after = Pt(3)
    return p


def H(text, lvl=1):
    return doc.add_heading(text, level=lvl)


def shade(cell, hex_):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_)
    tcPr.append(shd)


def table(header, rows, widths=None, size=9):
    t = doc.add_table(rows=1, cols=len(header))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(header):
        c = t.rows[0].cells[i]
        c.text = ""
        r = c.paragraphs[0].add_run(str(h))
        r.bold = True
        r.font.size = Pt(size)
        shade(c, "DCE6EE")
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = ""
            r = cells[i].paragraphs[0].add_run(str(v))
            r.font.size = Pt(size)
    if widths:
        for row in t.rows:
            for i, w in enumerate(widths):
                row.cells[i].width = Inches(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


fig_no = [0]


def figure(name, caption, width=6.5):
    doc.add_picture(str(FIG / name), width=Inches(width))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    fig_no[0] += 1
    P(f"Figure {fig_no[0]}. {caption}", italic=True, size=9, color=GREY, align=WD_ALIGN_PARAGRAPH.CENTER)


def pct(x, d=0):
    return f"{100 * x:.{d}f}%"


# --------------------------------------------------------------- numbers
D = R["dataset"]
L = R["ladder"]
lk = list(L)
proto, final = L[lk[0]]["pooled"], L[lk[-1]]["pooled"]
step2, step6 = L[lk[1]]["pooled"], L[lk[5]]["pooled"]
A = R["ablation"]
B = R["ranking_baselines"]
C = R["classification"]
c1, c2 = C["v1 lexicon (original TS)"], C["v2 lexicon (revised)"]
c3 = C["TF-IDF + logistic regression (leave-one-event-out)"]
G = R["geolocation"]
DD = R["dedupe"]
LB = R["loudness_bias"]
NW = R["network"]
EVO = A["Evidence only: outage evidence + severity, no social signal"]
S = R["sensitivity"]
missed = [n for n in units[units.true_silent_zone == 1].unit_name if n not in L[lk[-1]]["flagged"]]

# ================================================================ TITLE
P("Computational Social Media Analytics - Final Project Report", size=10, color=GREY, align=WD_ALIGN_PARAGRAPH.CENTER)
P("CrisisLens: Finding Silent Zones in Disaster Social Media", bold=True, size=20, color=NAVY,
  align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
P("Detecting badly hit places that go quiet online, and testing the method against independent ground truth",
  italic=True, size=11, color=GREY, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=12)

rich([("Project Title: ", True), ("CrisisLens: Finding Silent Zones in Disaster Social Media", False)])
rich([("Team Name (enrollment no.): ", True),
      ("Group 14 - Asad Ahmad ([enrollment no.]), Mohammad Yakub ([enrollment no.]), "
       "Subhashit Pathak ([enrollment no.]), Lokesh Yadav ([enrollment no.])", False)])

# ============================================================= ABSTRACT
H("Abstract")
P(f"Disaster dashboards often treat the number of social media posts as a measure of need. This favours "
  f"well-connected places and hides places whose power and phone networks have failed. CrisisLens looks for "
  f"'Silent Zones': badly hit districts that are much quieter online than their own normal activity predicts. "
  f"We evaluated the method on the CrisisLens v1 dataset ({D['posts']:,} posts, {D['authors']:,} accounts, "
  f"{D['units']} districts across the 2015 Nepal earthquake, Hurricane Maria 2017 and the 2018 Kerala floods). "
  f"The dataset is synthetic but contains ground truth that the pipeline never reads. The original prototype "
  f"found {proto['tp']} of {D['true_silent_zones']} true Silent Zones (F1 {proto['f1']:.2f}). After recalibrating "
  f"it from each event's own unlabelled data, screening out evacuation, and requiring independent outage evidence, "
  f"the final method found {final['tp']} of {D['true_silent_zones']} with no false alarms (F1 {final['f1']:.2f}). "
  f"A ranking by post volume, the 'loudness' dashboard, scored a ranking AUC of "
  f"{B['Loudness dashboard: most need posts']['auc_mean_over_events']:.2f}, worse than random. The later design "
  f"steps were developed on this same dataset, so the final scores are optimistic and need confirmation on new data.")

# ========================================================= INTRODUCTION
H("Introduction")
P("When a disaster strikes, people turn to social media. They ask for rescue, report injuries, and say what "
  "they need: water, food, shelter, medicine. Responders and humanitarian analysts read these streams to "
  "decide where to look first. The problem is that social media shows who can post, not only who needs help. "
  "A city with working power and mobile signal produces thousands of messages. A mountain district where the "
  "towers fell produces almost none. A dashboard that ranks places by message volume will send attention to "
  "the loud places, and the quiet places will disappear. We call this loudness bias.")
P("The obvious fix, flagging the quietest places, does not work either. Many rural districts are always "
  "quiet online because few people there use these platforms. The real question is therefore: is this place "
  "quieter than it normally is, given how hard it was hit? It is like noticing a friend who texts every day "
  "and then goes silent after a storm, while another friend who never replies quickly is simply behaving "
  "normally.")
P("CrisisLens answers this question in five steps. It sorts posts into ten need categories. It works out "
  "where the incident is, which may differ from where the author is. It removes reposts, copies and spam. "
  "It counts distinct local people instead of posts. Finally, it compares the voices it hears with the "
  "voices it would expect from each district's own pre-disaster activity. It then checks other explanations "
  "for silence, such as evacuation or a gap in data collection, and asks whether independent evidence "
  "(satellite night lights, mobile cell-site outages) supports the flag.")
P("This is a computational social media analytics problem rather than a pure machine-learning one. The "
  "object of study is who gets heard during a crisis. Social media is a biased, uneven sample of people, and "
  "the gaps in the data carry information. Our earlier prototype could not be evaluated honestly because "
  "its checks were graded with the same inputs the model used. This report evaluates the method for the "
  "first time against independent ground truth, and shows what worked, what failed, and why.")

# ===================================================== LITERATURE REVIEW
H("Literature Review")
P("Social media as a disaster sensor. Imran et al. (2015) survey how social media messages are processed in "
  "mass emergencies, from event detection and classification to summarisation, and set out the standard "
  "pipeline that CrisisLens follows. Kryvasheyeu et al. (2016) showed for Hurricane Sandy that per-capita "
  "Twitter activity across 50 US metropolitan areas correlates with per-capita economic damage. That supports "
  "using activity as a damage signal. It also assumes that damaged places can still post, the assumption "
  "CrisisLens questions.")
P("Humanitarian text classification. HumAID (Alam et al., 2021) provides about 77,000 human-labelled tweets "
  "from 19 disasters (2016-2019) with benchmark results for classic and transformer models. Its humanitarian "
  "classes are reproduced as gold labels in our dataset. CrisisTransformers (Lamsal et al., 2024) pre-trains "
  "language models on more than 15 billion tokens of crisis tweets and improves results on 18 crisis datasets. "
  "This line of work measures what is said. It does not measure who is missing.")
P("Silence and absence as signal. Two studies are closest to ours. Jin et al. (2017) model 'absenteeism', "
  "abnormal troughs in activity in location-based social networks, and use them for event detection with "
  "graph wavelets. Samuels, Taylor and Mohammadi (2020), in 'Silence of the Tweets', argue that activity "
  "drop-offs can indicate severe distress, and that survivorship bias must be handled before social media "
  "is used fairly in crises. Paul et al. (2020) detect power and communication outages from the content of "
  "tweets. CrisisLens builds on these ideas. It differs by conditioning silence on hazard severity, "
  "calibrating against peer districts in the same event, screening confounders (evacuation, data gaps), and "
  "fusing independent outage evidence. Above all, it is scored against ground truth that the detector never "
  "sees.")
P("Unequal visibility. Shelton et al. (2014) mapped the 'data shadows' of Hurricane Sandy and showed that "
  "geotagged content follows existing social and spatial inequality. Zou et al. (2019) found that, across 76 "
  "counties hit by Hurricane Harvey, places with better social and geographic conditions tweeted more. "
  "Dargin, Fan and Mostafavi (2021) found, through household surveys after three US hurricanes, that "
  "socioeconomic factors shape how different groups use and trust social media. Gupta, Liu and Mostafavi "
  "(2023) used observed internet-performance data to show that internet disruptions during extreme weather "
  "are spatially and socioeconomically unequal. Together these studies show that low online activity is not "
  "random, which is why we compare each place with its own baseline.")
P("Validity, bias and ethics. Olteanu et al. (2019) catalogue biases in social data, from population and "
  "platform biases to processing pitfalls. Crawford and Finn (2015) warn that crisis data reflects who has "
  "devices and attention, and raise privacy concerns. Our circular-validation problem, testing a model with "
  "labels built from its own inputs, is an instance of the evaluation pitfalls they describe.")
P("Independent evidence and coordination. Román et al. (2019) used daily VIIRS night-light data (the NASA "
  "Black Marble product family, including VNP46A2) to estimate where power was lost and restored in Puerto "
  "Rico after Hurricane Maria, finding an 80% drop in lights. We use night-light radiance as a corroborating "
  "signal. Giglietto et al. (2020) define coordinated link-sharing behaviour: accounts that share the same "
  "link within a short time window. We adapt this idea to detect donation-scam accounts that would otherwise "
  "inflate counts.")
P("Gap. To our knowledge, from the papers reviewed, earlier work either uses activity as a signal of damage "
  "or detects drops in activity. We found none that combines a severity-conditioned, baseline-corrected "
  "silence measure with confounder screening and independent-evidence fusion, and evaluates it against "
  "district-level ground truth on several hazard types. We do not claim that no one has done this. We claim "
  "a clear formulation and an honest evaluation of it.")

# ================================================================ OBJECTIVES
H("Project Objectives")
for t in [
    "Define a Silent Zone operationally: a badly hit district whose local online voices fall well below its "
    "own pre-event baseline, after allowing for the region-wide surge in posting.",
    "Build a pipeline that turns raw posts into need-labelled, correctly located, de-duplicated, distinct-author "
    "counts, and measure the accuracy of each stage against gold labels.",
    "Detect Silent Zones, separate them from other causes of silence (evacuation, data-collection gaps), and "
    "check them against independent outage evidence.",
    "Evaluate the detector honestly against independent district-level ground truth: compare it with volume, "
    "inverse-volume, exposure-only and evidence-only baselines, run ablations and threshold sensitivity, and "
    "report failures.",
    "Quantify loudness bias and the network structure of amplification, linking the work to the course modules "
    "on data validity, text analysis and network analysis.",
]:
    bullet(t)

# ================================================================ METHODOLOGY
H("Methodology")
H("Data Collection", 2)
P(f"We use the CrisisLens Evaluation Dataset v1.0 (CrisisLens_dataset_v1.xlsx). Its posts, authors and "
  f"outcomes are simulated with a fixed random seed (2026), so every result is reproducible. District names, "
  f"populations and event dates are real; other parameters are approximate scenario values. The workbook "
  f"separates pipeline inputs from evaluation-only sheets. Our pipeline code can load only the input sheets; "
  f"the gold sheets are loaded by a separate evaluation script.")
table(["Sheet", "Rows", "Role"], [
    ["posts", f"{D['posts']:,}", "Pipeline input: text, time, hashed author, declared location, followers, account age, repost link, optional coordinates"],
    ["admin_units", "42", "Pipeline input: population, hazard intensity, vulnerability, infrastructure, internet use, sub-localities"],
    ["events", "3", "Pipeline input: impact time, 72-hour window, 7 baseline days"],
    ["unit_daily_evidence", "420", "Independent evidence: night-light radiance, cell sites down, evacuees reported"],
    ["post_labels_gold", f"{D['posts']:,}", "Evaluation only: relevance, need labels, urgency, incident district, negation, duplicates, bot"],
    ["unit_ground_truth", "42", "Evaluation only: true communication status, evacuation, collection gaps, true_silent_zone"],
], widths=[1.4, 0.6, 4.6])
pe = D["per_event"]
table(["Event", "Hazard", "Posts", "Pre-event / post-event", "Accounts", "True Silent Zones"], [
    ["Nepal 2015", "Earthquake (MMI)", f"{pe['Nepal 2015']['posts']:,}", f"{pe['Nepal 2015']['pre_event']:,} / {pe['Nepal 2015']['post_event']:,}", f"{pe['Nepal 2015']['authors']:,}", D["true_silent_by_event"]["Nepal 2015"]],
    ["Maria 2017", "Cyclone (wind m/s)", f"{pe['Maria 2017']['posts']:,}", f"{pe['Maria 2017']['pre_event']:,} / {pe['Maria 2017']['post_event']:,}", f"{pe['Maria 2017']['authors']:,}", D["true_silent_by_event"]["Maria 2017"]],
    ["Kerala 2018", "Flood (depth m)", f"{pe['Kerala 2018']['posts']:,}", f"{pe['Kerala 2018']['pre_event']:,} / {pe['Kerala 2018']['post_event']:,}", f"{pe['Kerala 2018']['authors']:,}", D["true_silent_by_event"]["Kerala 2018"]],
], widths=[1.1, 1.4, 0.8, 1.6, 0.9, 1.2])
P(f"The posts include English, Spanish, romanised and Devanagari Nepali, and Malayalam (script and "
  f"romanised); {D['reposts']:,} reposts; {D['with_coordinates']:,} posts with coordinates; 'all clear' posts "
  f"that mention a need but negate it; donation-scam bots; posts from evacuees in camps in other districts; "
  f"and deliberate traps: one district that is quiet because it was evacuated (Alappuzha) and three with "
  f"crawler collection gaps. No live data was collected for this report.")

H("Data Preprocessing", 2)
bullet(" Each post is labelled relevant or not, with one or more of ten needs (rescue, medical, shelter, water, "
       "food, power, telecom, missing, road, safety) and an urgency of 0-3. We compare three classifiers: (1) "
       "the original prototype lexicon; (2) a revised lexicon with negation handling ('power is back', 'we are "
       "safe'), non-humanitarian vetoes (prayers, donation links, news updates) and Spanish, Nepali and Malayalam "
       "cues; and (3) a supervised TF-IDF character n-gram logistic regression trained leave-one-event-out.",
       "Classification.")
bullet(" The district of the incident comes from place names and sub-localities in the text, so 'trapped in "
       "Gorkha' posted from London belongs to Gorkha. For evacuees ('evacuated from Kuttanad, now at the camp in "
       "Kollam') the need is assigned to where people are now. If the text has no place, coordinates are matched "
       "to the nearest district centre.", "Incident location.")
bullet(" Native reposts and 'RT @' posts are amplification. 'Sharing:' and 'Please share:' posts are manual "
       "copies. Neither counts as a new voice. Near-duplicate reports are grouped into Need Units with MinHash "
       "(5-character shingles, 32 hashes, Jaccard >= 0.85) within each district, need and 6-hour block.",
       "Amplification and copies.")
bullet(" Accounts are scored on observable features only: share of posts with donation or crypto links, "
       "account age under 30 days, and fewer than 50 followers.", "Spam accounts.")
bullet(" A voice is a distinct, non-spam author with an original post located to the district, whose declared "
       "location is that district, only the region, or unknown. Authors who declare another district or another "
       "country are counted separately as voices 'about' the district.", "Local voices.")

H("Methods", 2)
P("Expected need (unchanged from the prototype). Exposed population = population x damage ratio, where the "
  "damage ratio comes from a stepped MMI curve for earthquakes, (wind/50)^3 capped at 0.9 for cyclones, and "
  "depth/(depth+1.5) capped at 0.8 for floods. Expected need = exposed population x vulnerability x "
  "infrastructure factor.")
P("Baseline and expected voices. The baseline B is the mean number of daily local voices over the 7 "
  "pre-event days, measured from posts rather than supplied. Expected voices in the 72-hour window are "
  "mu = B x 3 days x s, where s is the regional surge: the median ratio of observed to baseline voices across "
  "all districts in the same event. Peers thus set what 'normal disaster behaviour' looks like.")
P("Detectors. All are gated by severity: the district's damage ratio must be at or above the regional median.")
table(["Rule", "Fires when", "Purpose"], [
    ["A - residual", "(mu - O) / sqrt(mu + mu^2/theta) > 2; theta fitted from pre-event day-to-day variation", "Too quiet to be chance"],
    ["B - drop", "observed is more than 50% below mu, and mu >= 5", "Large collapse from own normal"],
    ["Z - zero voices", "no local need voices at all, and mu >= 3", "Total silence in small places"],
    ["F - fusion", "independent outage evidence (night-light drop >= 50% or cell sites down >= 50%) and residual > 1", "Weaker social signal accepted when outage is corroborated"],
], widths=[1.2, 3.6, 1.8])
P("Confounder screen. Evacuation: the reported evacuated share of the population is removed from mu and the "
  "rules are re-applied; if the district is no longer too quiet, the silence is 'explained by evacuation'. "
  "Data gap: if the longest run of hours with zero local voices is also empty of posts about the district "
  "from outsiders, the data feed itself is missing. A real cut-off silences locals while outsiders keep "
  "asking 'can't reach my family in X'. Corroboration: a final Silent Zone must have independent outage "
  "evidence. The pipeline is written in Python (pandas, scikit-learn, networkx, matplotlib). Its outputs are "
  "exported to the Next.js dashboard, which shows the flags, the screened-out districts and the evaluation.")
P(f"Evaluation design. Post-level stages are scored against post_labels_gold. Districts are scored against "
  f"true_silent_zone (precision, recall, F1, and ranking AUC averaged over events). We report a 'ladder' "
  f"that adds one change at a time to the prototype, {len(A) - 1} ablations, six ranking baselines and a "
  f"{S['configs']}-setting threshold sensitivity grid. Network analysis covers (1) the directed repost "
  f"network (reposter to original author) and (2) a coordination network linking accounts that post the same "
  f"link-bearing template within 60 minutes (after Giglietto et al., 2020).")

# ======================================================= RESULTS & DISCUSSION
H("Results and Discussion")
H("1. Loudness bias is large", 2)
P(f"In all three events, the true Silent Zones produced only {pct(LB['Kerala 2018']['share_of_need_posts_from_silent_zones'], 1)}-"
  f"{pct(LB['Maria 2017']['share_of_need_posts_from_silent_zones'], 1)} of need posts, while holding "
  f"{pct(LB['Kerala 2018']['share_of_expected_need_in_silent_zones'])}-{pct(LB['Nepal 2015']['share_of_expected_need_in_silent_zones'])} "
  f"of expected need. Post volume tracked normal connectivity (Spearman rho with baseline "
  f"{LB['Nepal 2015']['spearman_volume_vs_baseline']:.2f}-{LB['Maria 2017']['spearman_volume_vs_baseline']:.2f}), not damage "
  f"(rho with damage ratio {LB['Maria 2017']['spearman_volume_vs_damage_ratio']:.2f} to {LB['Nepal 2015']['spearman_volume_vs_damage_ratio']:.2f}). "
  f"No Silent Zone appeared in the top half of any volume ranking. A volume-ranked dashboard scored ranking "
  f"AUC {B['Loudness dashboard: most need posts']['auc_mean_over_events']:.2f}, which means it reliably put "
  f"the worst-off places last.")
figure("fig_loudness_bias.png", "Need-post volume per district in the first 72 hours. Orange bars are true Silent Zones.")

H("2. Pipeline stages, measured against gold labels", 2)
table(["Stage", "Result", "Note"], [
    ["Relevance - original lexicon", f"F1 {c1['relevance']['f1']:.2f} (P {c1['relevance']['precision']:.2f}, R {c1['relevance']['recall']:.2f})",
     f"0% of negated posts handled; Nepali recall {c1['relevance_recall_by_lang']['ne']:.0%}, Spanish {c1['relevance_recall_by_lang']['es']:.0%}"],
    ["Needs - original lexicon", f"micro-F1 {c1['need_micro_f1']:.2f}", f"urgency weighted kappa {c1['urgency_weighted_kappa']:.2f}"],
    ["Relevance - TF-IDF + LR, unseen event", f"F1 {min(c3['relevance_f1_by_event'].values()):.2f}-{max(c3['relevance_f1_by_event'].values()):.2f}",
     f"needs micro-F1 {min(c3['need_micro_f1_by_event'].values()):.2f}-{max(c3['need_micro_f1_by_event'].values()):.2f}; fairest generalisation estimate"],
    ["Relevance - revised lexicon", f"F1 {c2['relevance']['f1']:.2f}; needs micro-F1 {c2['need_micro_f1']:.2f}",
     "Revised on this dataset's templates: optimistic, not a generalisation estimate"],
    ["Incident location", f"{pct(G['incident_location_accuracy'], 1)} correct", f"Using the author's location instead: {pct(G['author_location_would_be_correct'])} correct"],
    ["Amplification (reposts)", f"F1 {DD['amplification']['f1']:.2f}", f"{DD['amplification']['tp']:,} reposts"],
    ["Copies ('Sharing:')", f"P {DD['copies']['precision']:.2f}, R {DD['copies']['recall']:.2f}", "Copy-pastes without a prefix are missed"],
    ["Independent reports", f"P {DD['independent_report']['precision']:.2f}, R {DD['independent_report']['recall']:.2f}",
     f"Raw relevant posts overcount independent reports {DD['inflation']['posts_per_independent_report']:.2f}x"],
    ["Spam accounts", f"{DD['spam_accounts']['tp']}/{DD['spam_accounts']['n_gold_bot_accounts']} found, 0 false", "Observable features only"],
], widths=[1.9, 1.9, 2.8])
P("Two lessons stand out. First, separating where the incident is from where the author is matters a lot: "
  f"author location would have placed only {pct(G['author_location_would_be_correct'])} of needs correctly. "
  "Second, the original lexicon could not handle negation or non-English posts, so a district whose residents "
  "posted 'power is back' or wrote in Nepali would have been misread. The revised lexicon's perfect score "
  "reflects tuning to synthetic templates. Real posts are far more varied, and the leave-one-event-out "
  "model's 0.85-0.96 is the better guide.")
figure("fig_classifier.png", "Per-need F1 of the original and revised lexicons against gold need labels.", 6.0)

H("3. Silent Zone detection: the prototype, then each improvement", 2)
rows = []
for k in lk:
    v = L[k]["pooled"]
    rows.append([k.split(" ", 1)[1], v["tp"], v["fp"], v["fn"], f"{v['precision']:.2f}", f"{v['recall']:.2f}", f"{v['f1']:.2f}"])
table(["Configuration (cumulative)", "TP", "FP", "FN", "Precision", "Recall", "F1"], rows,
      widths=[3.2, 0.45, 0.45, 0.45, 0.7, 0.6, 0.5])
figure("fig_ladder.png", "Each step evaluated against independent ground truth (42 districts, 10 true Silent Zones).")
P(f"The prototype as built found {proto['tp']} of 10 Silent Zones (F1 {proto['f1']:.2f}). Its partial success "
  f"was partly accidental: it compared crisis-need authors with a baseline of everyday activity. Making the "
  f"comparison consistent (step 2) dropped recall to {step2['recall']:.1f}. This revealed the real faults, "
  f"which were in the constants:")
bullet(" Normal districts post about as much as usual, or more, after impact, so the prototype's fixed "
       "'exposure elasticity' set expectations wrongly. Using the peer median ratio fixed this.", "No crisis surge.")
bullet(" With theta = 10 the residual can barely exceed 2 for small counts. Pre-event day-to-day variation is "
       f"close to Poisson. Fixing theta at 10 lowers F1 to {A['fixed theta = 10']['f1']:.2f}.", "Over-dispersion assumed, not measured.")
bullet(" Gating on total expected need favours populous districts, so small remote places (Vieques, Utuado, "
       f"Rasuwa) could never be flagged. The gate reproduced the loudness bias we set out to remove. Using it "
       f"instead of a severity gate cuts recall to {A['size gate (expected need) instead of severity gate']['recall']:.1f}.",
       "A size-biased gate.")
P(f"Steps 3-6 raise precision from {L[lk[2]]['pooled']['precision']:.2f} to {step6['precision']:.2f}. The "
  f"evacuation screen correctly clears Alappuzha, the dataset's evacuation trap and the highest-scoring "
  f"district by social signal alone. Corroboration removes Ernakulam, a large city that was quieter than its "
  f"peers but not cut off. The fusion rule (step 7) recovers Gorkha, Sindhupalchok and Vieques. Their social "
  f"drops (31-59%) were too small to be significant alone, but outage evidence was strong. The final method "
  f"found {final['tp']} of 10 with no false alarms (F1 {final['f1']:.2f}). It missed {', '.join(missed) or 'none'}: a "
  f"district with about 1 voice per day, where silence and normal quiet cannot be told apart. The evacuation "
  f"adjustment also pushed its expected count just below the zero-voice rule's minimum.")
figure("fig_observed_vs_expected.png", "Observed vs expected local voices (log scales). Diamonds are true Silent Zones; blue rings are final flags.")

H("4. Does the social signal add anything?", 2)
rows = [[k, f"{v['auc_mean_over_events']:.2f}", f"{v['r_precision']['precision']:.2f}"] for k, v in B.items()]
table(["Ranking", "AUC (mean of 3 events)", "Precision at k = no. of true SZ"], rows, widths=[3.6, 1.4, 1.6])
P(f"Honestly, in this dataset, mobile cell-site outage reports alone rank Silent Zones perfectly (AUC "
  f"{B['Cell sites down only']['auc_mean_over_events']:.2f}). "
  f"But used as a flagging rule, outage evidence alone over-flags: it found all 10 Silent Zones with "
  f"{EVO['fp']} false alarms (precision {EVO['precision']:.2f}). In Puerto Rico almost everyone lost power, so "
  f"darkness alone cannot single out the cut-off municipalities. Adding the social shortfall removed every one "
  f"of those false alarms. Social media is not a replacement for infrastructure data. It is the layer that "
  f"says which dark places have also gone quiet. It also helps where operator data is missing or late, which is "
  f"common in real disasters. Inverse volume (AUC "
  f"{B['Inverse volume: fewest need posts']['auc_mean_over_events']:.2f}) also ranks well here, because the "
  f"synthetic Silent Zones are mostly small, remote places. We expect real data to separate it from the "
  f"baseline-corrected method more sharply.")
figure("fig_ranking_baselines.png", "Ranking quality of single signals. Dashed line = random ranking.", 6.0)

H("5. Ablation and sensitivity", 2)
rows = [[k, v["tp"], v["fp"], f"{v['precision']:.2f}", f"{v['recall']:.2f}", f"{v['f1']:.2f}"] for k, v in A.items()]
table(["Variant (one change from final)", "TP", "FP", "Precision", "Recall", "F1"], rows, widths=[3.6, 0.45, 0.45, 0.7, 0.6, 0.5])
P(f"The two choices that matter most are counting voices from the place rather than about it (F1 "
  f"{A['count voices ABOUT (any author location)']['f1']:.2f} without it) and the severity gate. Counting posts "
  f"instead of authors added {A['count posts instead of authors']['fp']} false alarms. Measured and supplied "
  f"baselines gave the same result, because the supplied values in this dataset are close to the measured "
  f"ones. Dropping the confounder screen recovered Rasuwa but re-admitted the evacuated Alappuzha; dropping "
  f"the surge factor recovered Rasuwa but added San Juan, the best-connected municipality. Both score a "
  f"slightly higher F1, and we still kept both, because sending a team to an evacuated or functioning place is "
  f"a costly mistake, and choosing the variant with the best score on the test set would be further "
  f"overfitting. Across the {S['configs']} threshold settings, F1 ranged "
  f"{S['f1_min']:.2f}-{S['f1_max']:.2f} (median {S['f1_median']:.2f}), so the result does not depend on one "
  f"lucky threshold.")
figure("fig_ablation.png", "Ablation: remove one design choice at a time (pooled F1, true and false positives).", 6.0)

H("6. How small a place can we hear going silent?", 2)
P("A residual above 2 needs a drop larger than about 2/sqrt(mu). A district expected to produce 400 voices "
  "can be flagged at a 10% drop; one expected to produce 6 needs about 80%. Gorkha and Sindhupalchok were "
  "below this line, which is why social media alone missed them. This is a basic limit of silence detection, "
  "not a bug, and it is the strongest argument for fusing independent evidence.")
figure("fig_detectability.png", "Minimum detectable drop vs expected voices. True Silent Zones in orange.", 5.8)
figure("fig_timelines.png", "Local voices relative to each district's own pre-event average (12-hour rolling).")

H("7. Network analysis and social behaviour", 2)
n1, n2, n3 = NW["Nepal 2015"], NW["Maria 2017"], NW["Kerala 2018"]
P(f"Amplification is concentrated. The repost networks have {n1['amplification_nodes']}-{n3['amplification_nodes']} "
  f"accounts, with in-degree Gini {n3['gini_in_degree']:.2f}-{n1['gini_in_degree']:.2f}: a few accounts receive "
  f"most reposts. Reposts per district track normal connectivity (Spearman rho "
  f"{n3['spearman_reposts_vs_baseline']:.2f}-{n2['spearman_reposts_vs_baseline']:.2f}), and true Silent Zones received "
  f"only {pct(n3['reposts_to_true_silent_zones_share'], 1)}-{pct(n2['reposts_to_true_silent_zones_share'], 1)} of all "
  f"reposts. The social graph magnifies loudness bias; it does not correct it. The coordination network found "
  f"one tight cluster of {n1['coordination_nodes']} scam accounts per event, matching the gold bot list exactly "
  f"(precision and recall 1.00).")
e = R["echo_signal"]
top = list(R["cooccurrence"].items())[:3]
P(f"Need co-occurrence: the strongest pairings were {top[0][0].replace('+', ' + ')} (lift {top[0][1]['lift']:.1f}), "
  f"{top[1][0].replace('+', ' + ')} (lift {top[1][1]['lift']:.1f}) and {top[2][0].replace('+', ' + ')} (lift {top[2][1]['lift']:.1f}). "
  f"Telecom + missing is the 'can't reach my family' signature. Among posts about a district written from "
  f"elsewhere, {pct(e['mean_echo_share_true_silent'])} were of this kind for Silent Zones vs "
  f"{pct(e['mean_echo_share_other'])} for other districts. This 'echo' of silence is real but noisy as a "
  f"ranking signal (AUC {e['auc_mean_over_events']:.2f}).")
figure("fig_network_nepal.png", "Nepal repost network (largest component). Node size = reposts received; orange = 5 or more.", 4.6)

H("8. Limitations", 2)
for lead, t in [
    ("Synthetic data. ", "Posts, authors and outcomes are simulated. The results show the method works on a "
     "realistic, independently labelled test bed, not that it works on real disasters."),
    ("Development on the test set. ", "Steps 3-7 of the ladder and the revised lexicon were designed after "
     "seeing failures on this dataset, so their scores are optimistic. Only the prototype row (step 1) and the "
     "leave-one-event-out classifier are clean estimates. A fresh dataset (new seed or real events) is needed "
     "to confirm the final method."),
    ("Small sample. ", "42 districts and 10 positives. One district changes recall by 10 points."),
    ("Evidence availability. ", "Cell-site and night-light data were available for every district here. In "
     "real disasters they are often delayed, cloudy or missing."),
    ("Thresholds. ", "Residual > 2, drop > 50%, corroboration >= 50% and fusion > 1 are chosen, not learned, "
     "although the sensitivity grid shows they are not knife-edge."),
    ("Identity and location. ", "One account is treated as one person, and declared location is trusted. "
     "Multiple accounts, VPNs and stale profiles would add noise."),
    ("Ethics. ", "Author IDs are hashed. Outputs are advisory review flags, not confirmations of need; a human "
     "must check before acting, and a false 'all clear' is as harmful as a false alarm."),
]:
    bullet(t, lead)

H("9. Conclusion and future work", 2)
P("Post volume measures connectivity, not need. Ranking by volume put cut-off districts last in every "
  "event. A silence detector must compare each place with its own normal, allow for the region-wide surge, "
  "and avoid gates that favour big populations. Even then, social media alone cannot hear small places go "
  "quiet. Fusing it with independent outage evidence, and screening out evacuation, produced a precise and "
  "explainable review list. Next steps: (1) a pre-registered test of the final method on a fresh dataset; "
  "(2) real posts from HumAID events paired with Black Marble night lights; (3) replacing the lexicon with "
  "a multilingual crisis model such as CrisisTransformers. The CrisisLens dashboard now loads these results "
  "(analysis/export_dashboard.py), so every flag on screen shows the same evidence as this report.")
P("Reproducibility: python analysis/evaluate.py (about 8 minutes), then python analysis/build_report.py. "
  "Original results come from analysis/output/results.json; added evaluations come from analysis/output/realdata/.", italic=True, size=9, color=GREY)

from realdata.report_sections import append_sections
append_sections(OUT, H, P, table)

# ================================================================ REFERENCES
H("References")
refs = [
    "Alam, F., Qazi, U., Imran, M., & Ofli, F. (2021). HumAID: Human-annotated disaster incidents data from Twitter with deep learning benchmarks. Proceedings of the International AAAI Conference on Web and Social Media (ICWSM), 15. arXiv:2104.03090.",
    "Crawford, K., & Finn, M. (2015). The limits of crisis data: Analytical and ethical challenges of using social and mobile data to understand disasters. GeoJournal, 80.",
    "Dargin, J. S., Fan, C., & Mostafavi, A. (2021). Vulnerable populations and social media use in disasters: Uncovering the digital divide in three major U.S. hurricanes. International Journal of Disaster Risk Reduction, 54, 102043.",
    "Giglietto, F., Righetti, N., Rossi, L., & Marino, G. (2020). It takes a village to manipulate the media: Coordinated link sharing behavior during 2018 and 2019 Italian elections. Information, Communication & Society, 23(6), 867-891.",
    "Gupta, Y., Liu, Z., & Mostafavi, A. (2023). Digital divide in disasters: Investigating spatial and socioeconomic disparities in internet service disruptions during extreme weather events. arXiv:2312.08640.",
    "Imran, M., Castillo, C., Diaz, F., & Vieweg, S. (2015). Processing social media messages in mass emergency: A survey. ACM Computing Surveys, 47(4), 67:1-67:38.",
    "Jin, F., Chen, F., Khandpur, R. P., & Ramakrishnan, N. (2017). Absenteeism detection in social media. Proceedings of the SIAM International Conference on Data Mining (SDM), 606-614.",
    "Kryvasheyeu, Y., Chen, H., Obradovich, N., Moro, E., Van Hentenryck, P., Fowler, J., & Cebrian, M. (2016). Rapid assessment of disaster damage using social media activity. Science Advances, 2(3), e1500779.",
    "Lamsal, R., Read, M. R., & Karunasekera, S. (2024). CrisisTransformers: Pre-trained language models and sentence encoders for crisis-related social media texts. Knowledge-Based Systems. arXiv:2309.05494.",
    "NASA LAADS DAAC. VNP46A2: VIIRS/NPP Daily Gap-filled Lunar BRDF-Adjusted Nighttime Lights (Black Marble). https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/VNP46A2",
    "Olteanu, A., Castillo, C., Diaz, F., & Kiciman, E. (2019). Social data: Biases, methodological pitfalls, and ethical boundaries. Frontiers in Big Data, 2, 13.",
    "Paul, U., Ermakov, A., Nekrasov, M., Adarsh, V., & Belding, E. (2020). #Outage: Detecting power and communication outages from social networks. Proceedings of The Web Conference 2020 (WWW '20).",
    "Román, M. O., Stokes, E. C., Shrestha, R., Wang, Z., Schultz, L., Sepúlveda Carlo, E. A., et al. (2019). Satellite-based assessment of electricity restoration efforts in Puerto Rico after Hurricane Maria. PLOS ONE, 14(6), e0218883.",
    "Samuels, R., Taylor, J. E., & Mohammadi, N. (2020). Silence of the Tweets: Incorporating social media activity drop-offs into crisis detection. Natural Hazards, 103.",
    "Shelton, T., Poorthuis, A., Graham, M., & Zook, M. (2014). Mapping the data shadows of Hurricane Sandy: Uncovering the sociospatial dimensions of 'big data'. Geoforum, 52, 167-179.",
    "Zou, L., Lam, N. S. N., Shams, S., Cai, H., Meyer, M. A., Yang, S., Lee, K., Park, S.-J., & Reams, M. A. (2019). Social and geographical disparities in Twitter use during Hurricane Harvey. International Journal of Digital Earth, 12(11), 1300-1318.",
]
for r in refs:
    p = doc.add_paragraph(r)
    p.paragraph_format.left_indent = Inches(0.3)
    p.paragraph_format.first_line_indent = Inches(-0.3)
    p.paragraph_format.space_after = Pt(4)
    for run in p.runs:
        run.font.size = Pt(9.5)

# ===================================================== CONTRIBUTIONS
H("Contribution of each team member")
P("[To be completed by the team. Each member must be able to explain and modify any part of the code and report.]",
  italic=True, color=GREY)
table(["Name", "Contribution"], [
    ["Asad Ahmad", "[fill in]"], ["Mohammad Yakub", "[fill in]"],
    ["Subhashit Pathak", "[fill in]"], ["Lokesh Yadav", "[fill in]"]], widths=[1.8, 4.8], size=10)

out = ROOT / "output" / "CrisisLens_Final_Report.docx"
doc.save(out)
print("saved", out)
