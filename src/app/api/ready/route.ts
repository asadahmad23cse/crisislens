import { NextResponse } from "next/server";
import { runPipeline, listEvents } from "@/lib/crisislens/pipeline/run";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = listEvents();
    // Check that all events have run successfully
    let needUnits = 0;
    let silentZones = 0;
    for (const e of events) {
      const r = runPipeline(e.event_id);
      needUnits += r.needUnits.length;
      silentZones += r.silentZones.length;
    }
    return NextResponse.json({
      status: "ready",
      events: events.length,
      need_units_total: needUnits,
      silent_zones_total: silentZones,
      event_ids: events.map((e) => e.event_id),
    });
  } catch (e: any) {
    return NextResponse.json(
      { status: "not_ready", error: e?.message ?? "unknown" },
      { status: 500 },
    );
  }
}
