"""Append the added evaluations to the report, using saved numbers only.

Sections: robustness of the main-dataset result (Phase 4), real-tweet classifier
test on HumAID (Phase 1), the pre-registered partial real-data test (Phase 3),
and the evidence sources that are still blocked (Phase 2).
"""
import json

MODEL = {"v1": "Original keyword list", "v2": "Revised keyword list",
         "tfidf_lr": "Trained model (TF-IDF + logistic regression)"}


def _load(out, name):
    path = out / "realdata" / name
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def append_sections(out, H, P, table):
    p1, p2 = _load(out, "phase1_results.json"), _load(out, "phase2_results.json")
    p3, p4 = _load(out, "phase3_results.json"), _load(out, "phase4_results.json")

    if p4:
        b, t = p4["bootstrap"], p4["timeline"]
        f, pr = b["final_method"], b["prototype_v1"]
        H("Robustness of the main-dataset result")
        P(f"With only 42 districts and 10 true Silent Zones, one district moves the scores a lot. We resampled the "
          f"districts {p4['bootstrap_draws']:,} times, within each event, and recomputed the scores of the frozen "
          f"final method and of the original prototype. Nothing in the method was changed.")
        table(["Method", "Precision (95% interval)", "Recall (95% interval)", "F1 (95% interval)"], [
            [name] + [f"{m[k]['point']:.2f} ({m[k]['ci_low']:.2f}–{m[k]['ci_high']:.2f})" for k in ("precision", "recall", "f1")]
            for name, m in (("Final method", f), ("Original prototype", pr))], size=9)
        P(f"The final method's F1 interval ({f['f1']['ci_low']:.2f}–{f['f1']['ci_high']:.2f}) lies mostly above the "
          f"prototype's ({pr['f1']['ci_low']:.2f}–{pr['f1']['ci_high']:.2f}), but the intervals are wide and they "
          f"overlap, as expected with so few positives. The intervals describe sampling of districts from this "
          f"dataset; they do not remove the optimism from tuning on it.")
        found = {h["hour"]: h for h in t["per_hour"]}
        early = [r for r in t["true_silent_zones"] if r["first_flag_hour"] is not None]
        h6 = sum(r["first_flag_hour"] <= 6 for r in early)
        h12 = sum(r["first_flag_hour"] <= 12 for r in early)
        false_early = t["districts_flagged_early_but_not_truly_silent"]
        P(f"How early can a Silent Zone be seen? We reran the frozen method with the window cut to 6, 12, ... 72 "
          f"hours after impact. {h6} of the 10 true Silent Zones were first flagged by hour 6 and {h12} by hour 12. "
          f"The count stays between {min(v['found'] for v in found.values())} and "
          f"{max(v['found'] for v in found.values())} from hour 12 to hour 72. "
          + (f"Short windows also raised {len(false_early)} brief false alarm(s) "
             f"({', '.join(x['unit'] + ' at hour ' + str(x['first_flag_hour']) for x in false_early)}) that are "
             f"not flagged at 72 hours. " if false_early else "")
          + "One caution: the evidence sheet is daily, so the impact day's night-light and cell-site values are "
            "treated as available from hour 6, which is generous.")
        P("A check on freshly generated data could not be run: the dataset's generator script is not in the "
          "repository.", italic=True, size=9)

    if p1:
        rows = [r for r in p1["metrics"] if r["domain"] == "real" and r["target"] == "restricted"
                and r["event"] in ("hurricane_maria_2017", "kerala_floods_2018")]
        kw = [r["f1"] for r in rows if r["model"] != "tfidf_lr"]
        tr = [r["f1"] for r in rows if r["model"] == "tfidf_lr"]
        H("Real-data evaluation: classifier on real tweets (partial test)")
        P(f"HumAID adds {p1['audit']['raw_rows']:,} real, human-labelled tweets from 19 disasters beside the "
          f"simulated dataset. On Hurricane Maria and the Kerala floods, the keyword lists scored F1 "
          f"{min(kw):.2f}–{max(kw):.2f}, against about {sum(tr) / len(tr):.2f} for a model trained on other "
          f"disasters. The revised keyword list, which scored 1.00 on the simulated posts, fell to "
          f"{next(r['f1'] for r in rows if r['model'] == 'v2' and 'maria' in r['event']):.2f} on real Maria tweets, "
          f"below the original list. That confirms it was fitted to the simulation. Real posts need a trained classifier.")
        table(["Real event", "Classifier", "Tweets scored", "Precision", "Recall", "F1"],
              [[("Maria 2017" if "maria" in r["event"] else "Kerala 2018"), MODEL[r["model"]], f"{r['n']:,}",
                f"{r['precision']:.2f}", f"{r['recall']:.2f}", f"{r['f1']:.2f}"] for r in rows], size=9)
        P("This is a partial test. HumAID labels are topics, not needs: requests and displacement posts are "
          "treated as need reports, and non-humanitarian and sympathy posts as not; other topics are left out, "
          "so about a quarter of each event's tweets are scored. For each held-out disaster the trained model "
          "saw only other events. The keyword lists were not edited. The test checks whether a need report can "
          "be told from other posts. It does not test the ten needs, urgency, or Silent Zone detection. A "
          "multilingual transformer was not run (no suitable model was available offline and none was downloaded).")

    if p3:
        H("Real-data evaluation: pre-registered partial test of loudness")
        P("A real test of Silent Zone detection is not yet possible: HumAID has no pre-disaster tweets and no "
          "author locations, and real outage records could not be obtained (below). One component could be "
          "tested, and we wrote the test down before running it (analysis/PREREGISTRATION.md): on real tweets, "
          "does the number of tweets naming a district follow its population?")
        table(["Real event", "Tweets", "Located to a district", "Rank correlation with population", "p-value",
               "Most-named district (share)"],
              [[e["event"], f"{e['tweets']:,}", f"{e['located']:,} ({e['located_share']:.0%})",
                f"{e['spearman_rho_volume_vs_population']:+.2f}", f"{e['p_value']:.2f}",
                f"{e['top_district']} ({e['top_district_share_of_located']:.0%})"] for e in p3["events"]], size=9)
        P("The hypothesis was not supported. In both events the correlation is close to zero and not "
          "significant. In this filtered sample, mentions follow where the news was: San Juan, but also small, "
          "badly hit Vieques; Ernakulam, but also Alappuzha and Pathanamthitta. This fits one lesson from the "
          "main dataset: people everywhere post about hard-hit places, so mentions of a place are not voices "
          "from it. Without author locations, real tweets cannot separate the two. The sample is small, "
          "filtered and labelled, and only 14 districts per event can be located, so this result is weak "
          "evidence either way.")

    if p2:
        H("Real evidence sources still blocked")
        table(["Source", "Status", "What is needed"],
              [[s["name"], s["status"], s.get("next_step") or s["reason"]] for s in p2["sources"]], size=9)
        P("No real evidence value has been entered or estimated. The simulated evidence sheet is unchanged.")

    if p1:
        P("Added reference: Alam, F., Qazi, U., Imran, M., and Ofli, F. (2021). HumAID: Human-Annotated Disaster "
          "Incidents Data from Twitter with Deep Learning Benchmarks. ICWSM 15. "
          "https://doi.org/10.1609/icwsm.v15i1.18116", size=9)
