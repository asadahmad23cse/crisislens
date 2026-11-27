/**
 * CrisisLens — live logic for the interactive tabs (Analyze, Simulator).
 *
 * Runs in the browser. The lexicon patterns, gazetteer, thresholds and
 * per-district inputs come from insights.json, which is written by
 * analysis/export_dashboard.py. So a post typed here is classified by the
 * same patterns as the Python pipeline, and the simulator applies the same
 * decision rules (analysis/crisislens/pipeline.py).
 */
import insights from "./data/dataset/insights.json";

export const INSIGHTS = insights;
export const THRESHOLDS = insights.thresholds;
export type NeedKey = keyof typeof insights.lexicon.needs;

export const NEED_LABEL: Record<string, string> = {
  rescue: "Rescue",
  medical: "Medical",
  shelter: "Shelter",
  water: "Water",
  food: "Food",
  power: "Power",
  telecom: "Phone network",
  missing: "Missing people",
  road: "Blocked roads",
  safety: "Safety",
};

export const EVENT_LABEL: Record<string, string> = {
  "nepal-2015": "Nepal earthquake 2015",
  "maria-2017": "Hurricane Maria 2017",
  "kerala-2018": "Kerala floods 2018",
};

export interface UnitInputs {
  event_id: string;
  id: string;
  name: string;
  population: number;
  damage_ratio: number;
  median_damage: number;
  baseline: number;
  surge: number;
  theta: number;
  mu: number;
  observed: number;
  need_voices: number;
  voices_about: number;
  ntl_drop: number | null;
  cell_sites_down: number | null;
  evacuated_share: number;
  data_gap: boolean;
  status: string;
  flag: boolean;
  truth_silent: boolean;
  truth_reason: string;
}

export const UNITS = insights.units as UnitInputs[];

// ─── Post analysis ───────────────────────────────────────────────────────────
const rx = (src: string) => new RegExp(src, "iu");
const NEED_RX = Object.entries(insights.lexicon.needs).map(
  ([need, src]) => [need, rx(src)] as [string, RegExp],
);
const VETO_RX = rx(insights.lexicon.veto);
const NEGATION_RX = rx(insights.lexicon.negation);
const URGENT_RX = rx(insights.lexicon.urgent);
const RT_RX = /^RT @\w+:\s*/;
const SHARE_RX = /^(sharing|please share)\s*:\s*/i;
const SPAM_RX = /bit\.ly|giveaway|wallet in bio|usdt|btc|click to donate|donate here/i;

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Gazetteer {
  eventId: string;
  rx: RegExp;
  lookup: Map<string, { id: string; name: string }>;
  regionWords: string[];
}

const GAZETTEERS: Gazetteer[] = Object.entries(insights.gazetteer).map(([eventId, g]) => {
  const lookup = new Map<string, { id: string; name: string }>();
  for (const u of g.units) {
    lookup.set(u.name.toLowerCase(), { id: u.id, name: u.name });
    for (const p of u.places) {
      if (!lookup.has(p.toLowerCase())) lookup.set(p.toLowerCase(), { id: u.id, name: u.name });
    }
  }
  const names = [...lookup.keys()].sort((a, b) => b.length - a.length); // longest match first
  return {
    eventId,
    lookup,
    regionWords: g.region_words,
    rx: new RegExp(`(?<![\\w])(${names.map(escapeRx).join("|")})(?![\\w])`, "giu"),
  };
});

export interface PostAnalysis {
  text: string;
  relevant: boolean;
  needs: { need: string; cue: string }[];
  urgency: 0 | 1 | 2 | 3;
  negated: string | null;      // the "all clear" phrase that matched
  veto: string | null;         // the non-report phrase that matched
  amplification: boolean;
  copy: boolean;
  spamText: boolean;
  eventId: string | null;
  unit: { id: string; name: string } | null;
  place: string | null;        // the place name found in the text
  locationRule: "text" | "evacuee: where people are now" | "none";
  authorKind: "this district" | "another district" | "region only" | "outside the region" | "not given";
  countsAs: "local voice" | "voice about the district" | "not counted";
  reason: string;
}

function mentions(g: Gazetteer, text: string) {
  const out: { pos: number; place: string; unit: { id: string; name: string } }[] = [];
  for (const m of text.matchAll(g.rx)) {
    const unit = g.lookup.get(m[1].toLowerCase());
    if (unit) out.push({ pos: m.index ?? 0, place: m[1], unit });
  }
  return out;
}

export function analyzePost(rawText: string, declaredLocation = "", preferEvent?: string): PostAnalysis {
  const text = rawText.trim();
  const amplification = RT_RX.test(text);
  const body = text.replace(RT_RX, "");
  const copy = SHARE_RX.test(body);
  const spamText = SPAM_RX.test(text);

  // Needs, negation, vetoes: same order of checks as classify_v2 in Python
  const needs: { need: string; cue: string }[] = [];
  for (const [need, r] of NEED_RX) {
    const m = text.match(r);
    if (m) needs.push({ need, cue: m[0] });
  }
  const neg = text.match(NEGATION_RX);
  const veto = text.replace(/#\w+/gu, "").match(VETO_RX);
  const relevant = needs.length > 0 && !neg && !veto;
  let urgency: 0 | 1 | 2 | 3 = 0;
  if (relevant) {
    const set = new Set(needs.map((n) => n.need));
    if (set.has("rescue") || URGENT_RX.test(text)) urgency = 3;
    else if (["medical", "shelter", "water", "food", "missing"].some((n) => set.has(n))) urgency = 2;
    else urgency = 1;
  }

  // Incident location: the place in the text, not the author's place
  const order = [...GAZETTEERS].sort(
    (a, b) => Number(b.eventId === preferEvent) - Number(a.eventId === preferEvent),
  );
  let eventId: string | null = null;
  let unit: PostAnalysis["unit"] = null;
  let place: string | null = null;
  let locationRule: PostAnalysis["locationRule"] = "none";
  let gaz: Gazetteer | null = null;
  for (const g of order) {
    const ms = mentions(g, body);
    if (!ms.length) continue;
    gaz = g;
    eventId = g.eventId;
    let pick = ms[0];
    const nowAt = body.search(/now at|camp (in|at)/i);
    if (nowAt >= 0 && /evacuated from/i.test(body)) {
      const after = ms.find((m) => m.pos > nowAt);
      if (after) {
        pick = after;
        locationRule = "evacuee: where people are now";
      }
    }
    if (locationRule === "none") locationRule = "text";
    unit = pick.unit;
    place = pick.place;
    break;
  }

  // Where the author says they are
  let authorKind: PostAnalysis["authorKind"] = "not given";
  const loc = declaredLocation.trim().toLowerCase();
  if (loc) {
    const g = gaz ?? order[0];
    const ms = mentions(g, loc);
    if (ms.length) {
      authorKind = unit && ms[ms.length - 1].unit.id === unit.id ? "this district" : "another district";
    } else if (g.regionWords.some((w) => (w.length > 2 ? loc.includes(w) : loc.split(/[,\s]+/).includes(w)))) {
      authorKind = "region only";
    } else {
      authorKind = "outside the region";
    }
  }

  let countsAs: PostAnalysis["countsAs"] = "not counted";
  let reason: string;
  if (!unit) {
    reason = "No district from the three events is named, so the post cannot be placed.";
  } else if (spamText) {
    reason = "Donation or giveaway link text: treated as spam and not counted.";
  } else if (amplification || copy) {
    reason = "A repost or re-share is amplification, not a new voice.";
  } else if (authorKind === "another district" || authorKind === "outside the region") {
    countsAs = "voice about the district";
    reason = `The author is elsewhere, so this is a voice about ${unit.name}, not from it. It does not raise the local count.`;
  } else {
    countsAs = "local voice";
    reason = `Counts as one local voice from ${unit.name}${relevant ? " and one need report" : " (activity, not a need report)"}.`;
  }

  return {
    text, relevant, needs, urgency,
    negated: neg ? neg[0] : null,
    veto: veto ? veto[0] : null,
    amplification, copy, spamText, eventId, unit, place, locationRule, authorKind, countsAs, reason,
  };
}

// ─── Silent Zone decision (same rules as pipeline.py) ────────────────────────
export interface DecisionInput {
  baseline: number;        // local voices per day before the event
  surge: number;           // regional surge factor
  theta: number;           // dispersion fitted from pre-event days
  observed: number;        // local voices heard in the window
  needVoices: number;      // local need reports heard in the window
  damageRatio: number;
  medianDamage: number;
  evacuatedShare: number;
  ntlDrop: number | null;
  cellSitesDown: number | null;
  dataGap: boolean;
}

export interface Decision {
  mu: number;
  shortfall: number;
  residual: number;
  gate: boolean;
  corroborated: boolean;
  A: boolean;
  B: boolean;
  Z: boolean;
  F: boolean;
  raised: boolean;
  evacuationExplains: boolean;
  status: "silent_zone" | "explained_evacuation" | "explained_data_gap" | "uncorroborated" | "not_flagged";
  minDetectableDrop: number;
  explanation: string;
}

export function decide(i: DecisionInput, t = THRESHOLDS): Decision {
  const resid = (m: number) => (m - i.observed) / Math.sqrt(Math.max(0.5, m + (m * m) / i.theta));
  const dropOf = (m: number) => (m > 0 ? Math.min(1, Math.max(0, 1 - i.observed / m)) : 0);
  const mu = i.baseline * t.window_days * i.surge;
  const gate = i.damageRatio >= i.medianDamage;
  const corroborated = (i.ntlDrop ?? 0) >= t.corr || (i.cellSitesDown ?? 0) >= t.corr;
  const residual = resid(mu);
  const shortfall = dropOf(mu);
  const A = gate && residual > t.resid;
  const B = gate && shortfall > t.drop && mu >= t.min_mu_b;
  const Z = gate && i.needVoices === 0 && mu >= t.min_mu_z;
  const F = gate && corroborated && residual > t.fusion;
  const raised = A || B || Z || F;

  const stillSilent = (m: number) =>
    gate &&
    (resid(m) > t.resid ||
      (m >= t.min_mu_b && dropOf(m) > t.drop) ||
      (Z && m >= t.min_mu_z) ||
      (corroborated && resid(m) > t.fusion));
  const evacuationExplains = i.evacuatedShare > 0.01 && !stillSilent(mu * (1 - i.evacuatedShare));

  let status: Decision["status"] = "not_flagged";
  if (raised) {
    if (evacuationExplains) status = "explained_evacuation";
    else if (i.dataGap) status = "explained_data_gap";
    else if (!corroborated) status = "uncorroborated";
    else status = "silent_zone";
  }

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  let explanation: string;
  if (!gate) {
    explanation = `Not badly hit relative to its region (damage ${pct(i.damageRatio)} vs median ${pct(i.medianDamage)}), so quietness here is not treated as a warning sign.`;
  } else if (!raised) {
    explanation =
      i.observed >= mu
        ? `Badly hit, but it is as loud as expected or louder (${i.observed} voices against ${mu.toFixed(1)} expected). No rule fires.`
        : `Badly hit, but ${i.observed} voices against ${mu.toFixed(1)} expected is within normal variation. No rule fires.`;
  } else if (status === "explained_evacuation") {
    explanation = `Quiet, but ${pct(i.evacuatedShare)} of the population was evacuated. With evacuees removed, ${(mu * (1 - i.evacuatedShare)).toFixed(1)} voices are expected and the shortfall is no longer significant.`;
  } else if (status === "explained_data_gap") {
    explanation = "Quiet, but outsiders' posts about this district vanish in the same hours. That points to a hole in data collection, not a cut-off.";
  } else if (status === "uncorroborated") {
    explanation = "Quieter than expected, but night lights and cell sites show no outage. Kept for review, not flagged.";
  } else {
    explanation = `Badly hit, ${pct(shortfall)} below its expected voices, with outage evidence, and not explained by evacuation or a data gap. Flag for verification.`;
  }

  return {
    mu, shortfall, residual, gate, corroborated, A, B, Z, F, raised, evacuationExplains, status,
    minDetectableDrop: Math.min(1, t.resid / Math.sqrt(Math.max(mu, 0.01))),
    explanation,
  };
}

export function inputsOf(u: UnitInputs): DecisionInput {
  return {
    baseline: u.baseline, surge: u.surge, theta: u.theta, observed: u.observed, needVoices: u.need_voices,
    damageRatio: u.damage_ratio, medianDamage: u.median_damage, evacuatedShare: u.evacuated_share,
    ntlDrop: u.ntl_drop, cellSitesDown: u.cell_sites_down, dataGap: u.data_gap,
  };
}

export const STATUS_LABEL: Record<Decision["status"], string> = {
  silent_zone: "Silent Zone",
  explained_evacuation: "Quiet — explained by evacuation",
  explained_data_gap: "Quiet — likely data gap",
  uncorroborated: "Quiet — no outage evidence",
  not_flagged: "Not flagged",
};
