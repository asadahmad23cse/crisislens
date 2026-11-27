import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/crisislens/pipeline/run";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = runPipeline(id);
  if (id !== result.event.event_id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const needType = url.searchParams.get("need_type");
  const adminUnit = url.searchParams.get("admin_unit");
  const minUrgency = parseInt(url.searchParams.get("min_urgency") ?? "0", 10);
  const since = url.searchParams.get("since");
  const sinceMs = since ? Date.parse(since) : 0;
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(200, parseInt(url.searchParams.get("limit") ?? "50", 10));

  let filtered = result.needUnits.slice();
  if (needType) filtered = filtered.filter((nu) => nu.need_types.includes(needType as any));
  if (adminUnit) filtered = filtered.filter((nu) => nu.admin_unit_id === adminUnit);
  if (minUrgency > 0) filtered = filtered.filter((nu) => nu.peak_urgency >= minUrgency);
  if (sinceMs > 0) filtered = filtered.filter((nu) => Date.parse(nu.last_seen) >= sinceMs);

  // Sort by unique authors desc
  filtered.sort((a, b) => b.n_unique_authors - a.n_unique_authors);

  // Cursor pagination
  let startIdx = 0;
  if (cursor) {
    const cursorIdx = filtered.findIndex((nu) => nu.need_unit_id === cursor);
    if (cursorIdx >= 0) startIdx = cursorIdx + 1;
  }
  const page = filtered.slice(startIdx, startIdx + limit);
  const nextCursor =
    startIdx + limit < filtered.length ? page[page.length - 1]?.need_unit_id : null;

  return NextResponse.json({
    items: page,
    next_cursor: nextCursor,
    total: filtered.length,
  });
}
