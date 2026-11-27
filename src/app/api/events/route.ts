import { NextResponse } from "next/server";
import { listEvents } from "@/lib/crisislens/pipeline/run";

export const dynamic = "force-dynamic";

export async function GET() {
  // List all available events — runs the pipeline for each (cached) to
  // populate the metadata counts. Returns event_id + summary.
  const events = listEvents();
  return NextResponse.json(events);
}
