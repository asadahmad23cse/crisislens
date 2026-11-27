/**
 * CrisisLens — Stage 2: Need Classification
 *
 * Implements a lightweight, deterministic multi-label classifier over the
 * HumAID 10-class operational ontology (PRD §6.2). Production replaces this
 * with a fine-tuned DeBERTa-v3-base + ONNX; the interface is identical.
 *
 * Also runs:
 *   - Relevance head (humanitarian / not)
 *   - Urgency head (0-3 ordinal) — rule-based until annotated corpus exists
 */

import type { NeedType, Post, Urgency } from "./types";
import { NEED_TYPES } from "./types";

// ─── Lexicon (multi-label) ───────────────────────────────────────────────────
// Each need type is matched by a set of trigger phrases (lowercased substring
// match). Posts can match multiple types — multi-label.
const NEED_LEXICON: Record<NeedType, string[]> = {
  rescue_and_trapped: [
    "trapped", "under rubble", "collapsed", "buried", "rescue", "trapped inside",
    "under debris", "stuck under",
  ],
  medical_and_injury: [
    "injured", "wounded", "hospital", "doctor", "medicine", "medical", "broken leg",
    "broken arm", "first aid", "casualties", "blood", "fracture",
  ],
  shelter_and_displacement: [
    "tent", "shelter", "displaced", "homeless", "sleeping in", "tarpaulin",
    "no roof", "house gone", "house destroyed", "relief camp", "tent camp",
    "displacement",
  ],
  water_and_sanitation: [
    "water", "sanitation", "no clean water", "pipes broken", "contaminated",
    "toilet", "hygiene", "open defecation", "water shortage",
  ],
  food_and_nutrition: [
    "food", "hungry", "starving", "nutrition", "no food", "running out of food",
    "food stocks", "rations",
  ],
  power_and_energy: [
    "power", "electricity", "blackout", "no power", "power cut", "power lines",
    "no light", "charging", "solar",
  ],
  telecom_outage: [
    "cell", "signal", "telecom", "no service", "no cell", "no communication",
    "cell tower", "signal gone", "can't reach", "lost contact", "no signal",
    "intermittent signal",
  ],
  road_and_access_blocked: [
    "road", "highway", "blocked", "landslide", "rockfall", "access blocked",
    "road gone", "bridge collapse", "no road access", "cut off", "isolated",
    "road closed",
  ],
  missing_persons: [
    "missing", "looking for", "lost contact", "lost", "unaccounted",
    "can't find", "last seen",
  ],
  protection_and_safety: [
    "unsafe", "trafficking", "unaccompanied", "protection", "violence",
    "women", "children", "abuse", "harassment",
  ],
};

// Relevance filter — phrases that clearly mark humanitarian content
const HUMANITARIAN_MARKERS = NEED_TYPES.flatMap((k) => NEED_LEXICON[k]);

// Phrases that mark non-humanitarian content (prayers, donation pushes, info)
const NON_HUMANITARIAN_MARKERS = [
  "praying for", "prayers for", "thoughts with", "thoughts and prayers",
  "stay safe", "donate to", "link in bio", "rip", "so sad", "heartbreaking",
  "devastating", "tragic",
];

// Urgency triggers — life-threatening markers raise urgency to 3
const URGENCY_HIGH: string[] = [
  "trapped", "under rubble", "urgent", "now", "please help", "life-threatening",
  "no beds", "isolated", "buried", "lost contact",
];
const URGENCY_MEDIUM: string[] = [
  "injured", "wounded", "no food", "no water", "no power", "blocked",
  "displaced", "shelter", "missing", "running out",
];

export interface ClassificationResult {
  relevant: boolean;
  need_types: NeedType[];
  urgency: Urgency;
  confidence: number;     // [0,1] — based on lexicon match density
}

export function classifyPost(post: Post): ClassificationResult {
  const text = post.text.toLowerCase();

  // Multi-label need type matching
  const matched: NeedType[] = [];
  let matchCount = 0;
  for (const needType of NEED_TYPES) {
    const triggers = NEED_LEXICON[needType];
    for (const trigger of triggers) {
      if (text.includes(trigger)) {
        if (!matched.includes(needType)) matched.push(needType);
        matchCount++;
        break; // one match per type is enough for the multi-label head
      }
    }
  }

  // Relevance — humanitarian if any need-type matched OR if it doesn't look
  // like a non-humanitarian marker post. Amplifications are still relevant
  // (they amplify humanitarian content) but excluded from need counting later.
  const hasNonHumanitarianMarker = NON_HUMANITARIAN_MARKERS.some((m) =>
    text.includes(m),
  );
  const hasHumanitarianMarker = HUMANITARIAN_MARKERS.some((m) =>
    text.includes(m),
  );
  const relevant =
    matched.length > 0 || (hasHumanitarianMarker && !hasNonHumanitarianMarker);

  // Urgency head
  let urgency: Urgency = 0;
  if (matched.length > 0 || hasHumanitarianMarker) {
    urgency = 1; // concerning — default for any relevant post
    if (URGENCY_MEDIUM.some((m) => text.includes(m))) urgency = 2;
    if (URGENCY_HIGH.some((m) => text.includes(m))) urgency = 3;
  }

  // Confidence — denser trigger matches → higher confidence
  const confidence = Math.min(
    0.99,
    0.5 + matchCount * 0.12 + (relevant ? 0.1 : 0),
  );

  return { relevant, need_types: matched, urgency, confidence };
}
