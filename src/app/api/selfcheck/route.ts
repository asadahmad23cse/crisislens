import { NextResponse } from "next/server";
import { UNITS, decide, inputsOf, analyzePost } from "@/lib/crisislens/live";

export const dynamic = "force-dynamic";

// Checks that the browser-side decision rules reproduce the Python pipeline's
// status for every district, and that the lexicon patterns load in JavaScript.
export async function GET() {
  const mismatches = UNITS.filter((u) => decide(inputsOf(u)).status !== u.status).map((u) => ({
    unit: u.name,
    python: u.status,
    browser: decide(inputsOf(u)).status,
  }));
  const sample = analyzePost("People trapped under rubble in Barpak, Gorkha. Please send rescue teams now!", "London");
  return NextResponse.json({
    districts_checked: UNITS.length,
    mismatches,
    lexicon_ok: sample.relevant && sample.unit?.name === "Gorkha" && sample.urgency === 3,
  });
}
