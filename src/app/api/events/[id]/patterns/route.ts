import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/crisislens/pipeline/run";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = runPipeline(id);
  if (id !== result.event.event_id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({
    items: result.coOccurrence,
    total: result.coOccurrence.length,
    methodology: {
      approach: "Detect known humanitarian-crisis signatures from Need Unit co-occurrence within the same admin unit and 6h time window",
      signatures: [
        "telecom_outage + rescue_and_trapped → Communication Collapse",
        "telecom_outage + power_and_energy → Power-Telecom Cascade",
        "water_and_sanitation + shelter_and_displacement → Displacement Camp Crisis",
        "power_and_energy + medical_and_injury → Hospital Crisis",
        "road_and_access_blocked + food_and_nutrition → Supply Chain Breakdown",
        "road_and_access_blocked + medical_and_injury → Medical Access Crisis",
        "shelter_and_displacement + protection_and_safety → Vulnerable Population Risk",
        "water_and_sanitation + medical_and_injury → Disease Outbreak Risk",
      ],
      purpose:
        "These are patterns that the choropleth hides — co-occurrence reveals crisis signatures that responders recognize and can act on directly.",
    },
  });
}
