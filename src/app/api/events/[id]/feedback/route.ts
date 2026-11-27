import { NextResponse } from "next/server";

// In-memory feedback store — production persists to PostgreSQL.
// This is the only mechanism by which the system learns whether its flags
// were correct in live use, and it's the input to precision tracking (PRD §10).
const feedbackStore = new Map<string, { confirmed: boolean; ts: string; note?: string }>();

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const unitId = body.unit_id;
  const confirmed = !!body.confirmed;
  const note = typeof body.note === "string" ? body.note : undefined;
  if (!unitId || typeof unitId !== "string") {
    return NextResponse.json({ error: "unit_id required" }, { status: 400 });
  }
  const key = `${id}:${unitId}`;
  feedbackStore.set(key, {
    confirmed,
    ts: new Date().toISOString(),
    note,
  });
  return NextResponse.json({
    ok: true,
    event_id: id,
    unit_id: unitId,
    confirmed,
    ts: feedbackStore.get(key)!.ts,
    note,
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const items = [...feedbackStore.entries()]
    .filter(([k]) => k.startsWith(`${id}:`))
    .map(([k, v]) => ({ unit_id: k.split(":")[1], ...v }));
  return NextResponse.json({ items, total: items.length });
}
