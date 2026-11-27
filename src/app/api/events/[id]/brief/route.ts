import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/crisislens/pipeline/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface BriefRequest {
  audience?: "eoc" | "cluster_lead" | "ngo_field" | "researcher";
  max_words?: number;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = runPipeline(id);
  if (id !== result.event.event_id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as BriefRequest;
  const audience = body.audience ?? "eoc";
  const maxWords = body.max_words ?? 400;

  // Build a structured prompt with the key findings
  const brief_context = buildBriefContext(result, audience);
  const prompt = buildPrompt(brief_context, audience, maxWords);

  try {
    // Use the z-ai-web-dev-sdk to generate the analyst brief
    // The LLM is allowed for UI rationale per PRD §6.2 — never in the
    // classification path. This generates a natural-language situation report.
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an emergency operations analyst writing a situation report (sitrep) for an emergency operations center. You write clearly, concisely, and with operational specificity. You always cite the data points behind your conclusions. You distinguish confirmed findings from inferences. You always note coverage gaps and confidence levels. You never use filler phrases like 'in conclusion' or 'it is important to note'.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    });
    const brief = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({
      brief,
      audience,
      generated_at: new Date().toISOString(),
      event_id: id,
      word_count: brief.split(/\s+/).length,
      context_summary: brief_context,
    });
  } catch (e: any) {
    // Fallback: rule-based brief if the LLM call fails
    const fallback = generateFallbackBrief(result, audience);
    return NextResponse.json({
      brief: fallback,
      audience,
      generated_at: new Date().toISOString(),
      event_id: id,
      word_count: fallback.split(/\s+/).length,
      fallback: true,
      error: e?.message ?? "LLM call failed",
    });
  }
}

function buildBriefContext(result: any, audience: string) {
  const { event, finding, silentZones, criticalUnmetNeeds, coOccurrence, nighttimeLights, ablation } = result;
  const top5 = silentZones.slice(0, 5).map((s: any) => ({
    rank: s.rank,
    name: s.admin_unit_name,
    score: s.score,
    ci: [s.ci_low, s.ci_high],
    detectors: `${s.detector_a_triggered ? "A" : ""}${s.detector_b_triggered ? "+B" : ""}`,
    observed: s.observed_reporters,
    expected: s.expected_reporters,
    baseline: s.baseline_source,
  }));
  const topCritical = criticalUnmetNeeds.slice(0, 5).map((c: any) => ({
    name: c.admin_unit_name,
    expected: c.expected_need,
    urgency: c.urgency,
  }));
  const topPatterns = coOccurrence.slice(0, 4).map((p: any) => ({
    name: p.name,
    severity: p.severity,
    units: p.admin_units.length,
    occurrences: p.total_occurrences,
  }));
  return {
    event_name: event.name,
    hazard_type: event.hazard_type,
    country: event.country,
    impact_utc: event.impact_utc,
    posts_ingested: event.total_posts_ingested,
    relevant_posts: event.total_relevant_posts,
    need_units: event.total_need_units,
    silent_zones: event.total_silent_zones,
    unlocated_share: event.unlocated_share,
    headline_finding: finding.headline,
    loudest_unit: finding.loudest_unit,
    top_silent_zones: top5,
    critical_unmet_needs: topCritical,
    co_occurrence_patterns: topPatterns,
    nighttime_lights_correlation: nighttimeLights.correlation_score_vs_radiance_drop,
    ablation_lift_points: ablation.baseline_offset_lift_points,
    precision_at_k: finding.crisislens_precision_at_10,
    inverted_volume_baseline_precision: finding.inverted_volume_baseline_precision_at_10,
  };
}

function buildPrompt(ctx: any, audience: string, maxWords: number) {
  const audienceBrief = {
    eoc: "Emergency Operations Center analyst deciding where to send the next assessment team in the first 24 hours",
    cluster_lead: "Humanitarian cluster lead (WASH, Health, Shelter) coordinating across NGOs",
    ngo_field: "NGO field coordinator about to deploy to the area, needs to know what they're walking into",
    researcher: "Crisis informatics researcher reproducing and extending the method",
  }[audience];

  return `Write a ${maxWords}-word situation report for a ${audienceBrief}.

EVENT CONTEXT
- Event: ${ctx.event_name}
- Hazard: ${ctx.hazard_type}
- Country: ${ctx.country}
- Impact time (UTC): ${ctx.impact_utc}
- Posts ingested: ${ctx.posts_ingested.toLocaleString()} (${ctx.relevant_posts.toLocaleString()} relevant)
- Need Units detected: ${ctx.need_units}
- Silent Zones detected: ${ctx.silent_zones}
- Unlocated post share: ${(ctx.unlocated_share * 100).toFixed(0)}%

HEADLINE FINDING
${ctx.headline_finding}

LOUDEST UNIT (high post volume)
- ${ctx.loudest_unit.admin_unit_name}: ${ctx.loudest_unit.observed_reporters} reporters, damage percentile ${(ctx.loudest_unit.damage_percentile * 100).toFixed(0)}%

TOP SILENT ZONES (ranked)
${ctx.top_silent_zones.map((s: any) => `- #${s.rank} ${s.name}: score ${s.score} (CI [${s.ci[0]}, ${s.ci[1]}]), detectors ${s.detectors}, ${s.observed} observed vs ${s.expected} expected reporters, baseline ${s.baseline}`).join("\n")}

CRITICAL UNMET NEEDS (zero observed reporters despite high expected damage)
${ctx.critical_unmet_needs.length === 0 ? "None detected." : ctx.critical_unmet_needs.map((c: any) => `- ${c.name}: expected need ${c.expected.toLocaleString()}, urgency ${c.urgency}`).join("\n")}

CO-OCCURRENCE PATTERNS (crisis signatures)
${ctx.co_occurrence_patterns.length === 0 ? "None detected." : ctx.co_occurrence_patterns.map((p: any) => `- ${p.name} (${p.severity}): ${p.units} admin units, ${p.occurrences} occurrences`).join("\n")}

VALIDATION
- Data: simulated evaluation dataset (CrisisLens v1.0), not real posts
- Night lights vs social shortfall: r = ${ctx.nighttime_lights_correlation} (independent evidence sheet)
- Precision against the dataset's ground truth: ${ctx.precision_at_k} (fewest-posts ranking: ${ctx.inverted_volume_baseline_precision})

OUTPUT REQUIREMENTS
- Open with a one-sentence operational headline (no filler, no "the following report...").
- Lead with the top 3 silent zones and the specific assessment team recommendation for each.
- Note any critical unmet needs with zero observed reporters as immediate-priority items.
- Describe night-light or cell-site inputs only as simulated scenario indicators, not observed independent outage evidence. State plainly that the data are simulated and flags require real-world verification.
- Note coverage caveats (unlocated share) if > 15%.
- End with a single sentence on the highest-confidence next action.
- Do not invent numbers — use only what's in the context above.
- Maximum ${maxWords} words. No markdown headers, no bullet points, plain prose with short paragraphs.`;
}

function generateFallbackBrief(result: any, audience: string): string {
  const { event, finding, silentZones, criticalUnmetNeeds, coOccurrence, nighttimeLights } = result;
  const top3 = silentZones.slice(0, 3);
  const critical = criticalUnmetNeeds.slice(0, 3);
  const patterns = coOccurrence.slice(0, 3);

  let brief = `${event.name}: ${finding.headline} Ingested ${event.total_posts_ingested.toLocaleString()} posts, identified ${event.total_need_units} Need Units and ${silentZones.length} silent zones. `;

  brief += `Top priority silent zones: ${top3.map((s: any) => `${s.admin_unit_name} (score ${s.score}, ${s.detector_a_triggered && s.detector_b_triggered ? "both detectors" : s.detector_a_triggered ? "Detector A" : "Detector B"})`).join("; ")}. `;

  if (critical.length > 0) {
    brief += `Critical unmet needs (zero observed reporters despite high expected damage): ${critical.map((c: any) => `${c.admin_unit_name} (expected ${c.expected_need.toLocaleString()})`).join("; ")}. `;
  }

  if (patterns.length > 0) {
    brief += `Detected crisis signatures: ${patterns.map((p: any) => `${p.name} in ${p.admin_units.length} units`).join("; ")}. `;
  }

  brief += `In this synthetic scenario, the outage indicators and night-light drop are auxiliary inputs; their correlation is not empirical validation or observed outage evidence (r = ${nighttimeLights.correlation_score_vs_radiance_drop}). Treat every flag as advisory and verify it with real-world data. `;

  if (event.unlocated_share > 0.15) {
    brief += `Coverage caveat: ${(event.unlocated_share * 100).toFixed(0)}% of posts could not be geolocated — treat confidence accordingly. `;
  }

  brief += `Recommended next action: dispatch assessment teams to the top-ranked silent zones, prioritizing units where both detectors triggered.`;

  return brief;
}
