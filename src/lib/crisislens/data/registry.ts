/**
 * CrisisLens — Event Registry
 *
 * Each event provides: meta, admin units, post generator, impact time, window.
 * The pipeline runs identically across events — the only difference is the data.
 */

import type { AdminUnit, EventMeta, Post } from "../pipeline/types";

export interface EventDataset {
  meta: EventMeta;
  units: AdminUnit[];
  generatePosts: () => Post[];
  impactEpochMs: number;
  windowHours: number;
  hazardType: "earthquake" | "cyclone" | "flood";
}

// Import the three event datasets
import { NEPAL_2015 } from "./nepal2015";
import { MARIA_2017 } from "./maria2017";
import { KERALA_2018 } from "./kerala2018";

export const EVENT_REGISTRY: Record<string, EventDataset> = {
  "nepal-2015": NEPAL_2015,
  "maria-2017": MARIA_2017,
  "kerala-2018": KERALA_2018,
};

export const EVENT_LIST = Object.values(EVENT_REGISTRY).map((e) => ({
  event_id: e.meta.event_id,
  name: e.meta.name,
  hazard_type: e.meta.hazard_type,
  country: e.meta.country,
  impact_utc: e.meta.impact_utc,
  total_posts_ingested: e.meta.total_posts_ingested,
  total_silent_zones: e.meta.total_silent_zones,
}));

export function getEvent(eventId: string): EventDataset | null {
  return EVENT_REGISTRY[eventId] ?? null;
}
