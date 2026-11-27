"""Stage 2: need classification (relevance, 10 need labels, urgency 0-3).

Two lexicons are kept so the report can compare them honestly:

* ``classify_v1`` is a direct port of the original TypeScript lexicon
  (src/lib/crisislens/pipeline/classify.ts). It was written before this
  dataset existed, so its scores are an unbiased estimate of that design.
* ``classify_v2`` is the revised lexicon. It adds negation handling,
  non-humanitarian vetoes and Spanish / Nepali / Malayalam cues. It was
  revised after error analysis on this dataset, so its scores are optimistic.
"""
from __future__ import annotations

import re

NEEDS = ("rescue", "medical", "shelter", "water", "food",
         "power", "telecom", "missing", "road", "safety")

# --------------------------------------------------------------------------
# v1: port of the original TypeScript lexicon (substring match, no negation)
# --------------------------------------------------------------------------
V1_LEXICON = {
    "rescue": ["trapped", "under rubble", "collapsed", "buried", "rescue", "trapped inside",
               "under debris", "stuck under"],
    "medical": ["injured", "wounded", "hospital", "doctor", "medicine", "medical", "broken leg",
                "broken arm", "first aid", "casualties", "blood", "fracture"],
    "shelter": ["tent", "shelter", "displaced", "homeless", "sleeping in", "tarpaulin", "no roof",
                "house gone", "house destroyed", "relief camp", "tent camp", "displacement"],
    "water": ["water", "sanitation", "no clean water", "pipes broken", "contaminated", "toilet",
              "hygiene", "open defecation", "water shortage"],
    "food": ["food", "hungry", "starving", "nutrition", "no food", "running out of food",
             "food stocks", "rations"],
    "power": ["power", "electricity", "blackout", "no power", "power cut", "power lines",
              "no light", "charging", "solar"],
    "telecom": ["cell", "signal", "telecom", "no service", "no cell", "no communication",
                "cell tower", "signal gone", "can't reach", "lost contact", "no signal",
                "intermittent signal"],
    "road": ["road", "highway", "blocked", "landslide", "rockfall", "access blocked", "road gone",
             "bridge collapse", "no road access", "cut off", "isolated", "road closed"],
    "missing": ["missing", "looking for", "lost contact", "lost", "unaccounted", "can't find",
                "last seen"],
    "safety": ["unsafe", "trafficking", "unaccompanied", "protection", "violence", "women",
               "children", "abuse", "harassment"],
}
V1_NON_HUMANITARIAN = ["praying for", "prayers for", "thoughts with", "thoughts and prayers",
                       "stay safe", "donate to", "link in bio", "rip", "so sad", "heartbreaking",
                       "devastating", "tragic"]
V1_URGENT_HIGH = ["trapped", "under rubble", "urgent", "now", "please help", "life-threatening",
                  "no beds", "isolated", "buried", "lost contact"]
V1_URGENT_MED = ["injured", "wounded", "no food", "no water", "no power", "blocked", "displaced",
                 "shelter", "missing", "running out"]


def classify_v1(text: str) -> tuple[bool, list[str], int]:
    t = text.lower()
    labels = [n for n in NEEDS if any(k in t for k in V1_LEXICON[n])]
    hum = any(k in t for n in NEEDS for k in V1_LEXICON[n])
    non = any(k in t for k in V1_NON_HUMANITARIAN)
    relevant = bool(labels) or (hum and not non)
    urg = 0
    if relevant:
        urg = 1
        if any(k in t for k in V1_URGENT_MED):
            urg = 2
        if any(k in t for k in V1_URGENT_HIGH):
            urg = 3
    return relevant, labels, urg


# --------------------------------------------------------------------------
# v2: revised lexicon (regex, negation, vetoes, multilingual cues)
# --------------------------------------------------------------------------
def _rx(*pats: str) -> re.Pattern:
    return re.compile("|".join(pats), re.IGNORECASE)


V2_LEXICON = {
    "rescue": _rx(r"\btrapped\b", r"under (the )?(rubble|debris)", r"\bstuck (in|on)\b",
                  r"\bstranded\b", r"rescue (needed|teams now)|send rescue|coordinate rescue",
                  r"no rescue", r"send boats|helicopter|rooftops|on the roof",
                  r"atrapad", r"rescate", r"rescue venam", r"vellam kayari",
                  r"uddhar|उद्धार", r"thichiyeka", "കുടുങ്ങി", r"needs evacuation",
                  r"completely flattened"),
    "medical": _rx(r"injured|wounded|घाइते", r"hospital", r"\bdoctors?\b", r"medicines?\b",
                   r"\bmedical\b", r"ambulance", r"\bfever\b", r"insulin|dialysis|pharmacy",
                   r"health post", r"pacientes|patients", r"getting sick", r"snake bites?",
                   r"pregnant"),
    "shelter": _rx(r"\btents?\b", r"\btarp", r"\bshelter\b(?! material)|shelter material",
                   r"homeless", r"displaced", r"sleeping (outside|in the open)",
                   r"\bmats\b", r"evacuated from", r"fully under water", r"overcrowded",
                   r"roof gone", r"techo", r"toldos", r"basne thau", r"camp il kure"),
    "water": _rx(r"drinking water", r"clean water", r"safe water", r"water supply",
                 r"contaminated", r"send water", r"and water\b", r"\bagua\b",
                 r"\bpani\b", "കുടിവെള്ളം"),
    "food": _rx(r"\bfood\b", r"\brice\b", r"\brations\b",r"hungry", r"comida", r"\bkhana\b"),
    "power": _rx(r"electricity", r"blackout", r"generators?", r"power banks?", r"power cut",
                 r"no lights", r"\bluz\b", r"diesel"),
    "telecom": _rx(r"no signal|señal", r"network (completely )?(down|out)|mobile network",
                   r"cell tower", r"can'?t call", r"no calls", r"phones? (not reachable|dying)",
                   r"not answering phone", r"lost contact", r"no contact", r"can'?t reach",
                   r"\b1 bar\b"),
    "missing": _rx(r"\bmissing\b", r"lost contact", r"can'?t reach my", r"no sabemos nada",
                   r"unaccounted", r"looking for my", r"last seen", r"(anyone (with|have) news)",
                   r"if they are ok", r"uncle's family", r"anyone able to get to"),
    "road": _rx(r"road.{0,25}blocked|blocked by landslide|highway to .{0,25} blocked",
                r"block every road", r"landslide", r"bridge collapsed", r"unreachable by",
                r"cannot reach", r"cannot pass", r"only way in"),
    "safety": _rx(r"looting", r"afraid", r"\bunsafe\b", r"unaccompanied", r"protection",
                  r"scared", r"we are alive"),
}

# Content that mentions needs but is not a first-hand humanitarian report.
V2_VETO = _rx(r"pray", r"thoughts are with", r"donat", r"giveaway", r"\bclick\b", r"wallet",
              r"usdt|btc", r"bit\.ly", r"deployed", r"helpline", r"stay (safe|strong)",
              r"official advice", r"live updates", r"\bupdate:", r"damage assessment",
              r"declares emergency", r"death toll", r"situation report", r"relief flights",
              r"saddened", r"heartbreaking", r"volunteers collecting", r"why is the government",
              r"\balert\b", r"forecast", r"potholes", r"load shedding", r"flickered",
              r"stocking", r"before hurricane")

# "All clear" reports: the place is mentioned but the need is negated.
V2_NEGATION = _rx(r"\bis back\b", r"restored", r"no need to", r"\bis ok\b", r"\bis fine\b",
                  r"we are safe in", r"not injured", r"nobody trapped", r"open again",
                  r"no shortage")

URGENT = _rx(r"urgent|immediately|now!", r"ambulances cannot reach", r"\bdead\b",
             r"pacientes en riesgo", r"fuel running out at the hospital", r"no doctor",
             r"unaccounted")


def classify_v2(text: str) -> tuple[bool, list[str], int, bool]:
    """Return (relevant, need_labels, urgency, negated)."""
    labels = [n for n in NEEDS if V2_LEXICON[n].search(text)]
    negated = bool(V2_NEGATION.search(text))
    # Vetoes look at the sentence, not hashtags (#PrayForNepal is not a prayer post)
    if not labels or negated or V2_VETO.search(re.sub(r"#\w+", "", text)):
        return False, [], 0, negated
    # Urgency: life threat = 3, basic needs = 2, infrastructure / safety info = 1
    if "rescue" in labels or URGENT.search(text):
        urg = 3
    elif set(labels) & {"medical", "shelter", "water", "food", "missing"}:
        urg = 2
    else:
        urg = 1
    return True, labels, urg, negated
