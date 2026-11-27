"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell, CartesianGrid, ReferenceLine } from "recharts";
import { FlaskConical, AlertTriangle } from "lucide-react";
import { INSIGHTS } from "@/lib/crisislens/live";
import { RealDataResearch } from "./RealDataResearch";

const R = INSIGHTS.research;
const NAVY = "#0f2c4e";
const TEAL = "#0097a7";
const ORANGE = "#eb6834";
const GREY = "#a3a29c";

const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;

export function ResearchView() {
  const proto = R.ladder[0];
  const final = R.ladder[R.ladder.length - 1];
  const total = final.tp + final.fn;
  const loud = R.ranking.find((r) => r.name.startsWith("Loudness"));
  const evidenceOnly = R.ablation.find((a) => a.name.startsWith("Evidence only"));

  const ladder = R.ladder.map((l, i) => ({
    step: `${i + 1}. ${l.step.replace(/^\+ /, "+ ")}`,
    Precision: l.precision,
    Recall: l.recall,
    F1: l.f1,
  }));
  const ranking = [...R.ranking].sort((a, b) => a.auc - b.auc).map((r) => ({
    name: r.name.split(":")[0].replace(" (final method's score)", ""),
    auc: r.auc,
    kind: r.name.startsWith("Social") ? "social" : /Night|Cell/.test(r.name) ? "evidence" : "other",
  }));
  const loudness = R.loudness.map((l) => ({
    event: l.event,
    "Share of need posts": +(l.share_of_need_posts_from_silent_zones * 100).toFixed(1),
    "Share of expected need": +(l.share_of_expected_need_in_silent_zones * 100).toFixed(1),
  }));
  const net = Object.entries(R.network) as [string, (typeof R.network)["Nepal 2015"]][];

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-primary to-[#1a4060] text-primary-foreground p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-primary-foreground/70 font-semibold mb-1">
              Research overview — all three events together
            </div>
            <div className="text-base md:text-lg font-semibold leading-snug">
              Everything the project measured, scored against an answer key the pipeline never reads.
            </div>
          </div>
        </div>
      </Card>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile value={R.dataset.posts.toLocaleString()} label="posts analysed" />
        <Tile value={`${R.dataset.units}`} label="districts, 3 disasters" />
        <Tile value={`${final.tp} of ${total}`} label="Silent Zones found (final method)" accent />
        <Tile value={`${final.fp}`} label="false alarms (final method)" accent />
        <Tile value={`${proto.tp} of ${total}`} label="found by the original prototype" />
        <Tile value={(loud?.auc ?? 0).toFixed(2)} label="ranking AUC of a volume dashboard (0.5 = random)" />
      </div>

      {/* Ladder */}
      <Card className="p-4">
        <div className="text-sm font-semibold">From prototype to final method</div>
        <div className="text-xs text-muted-foreground mb-2">
          Each row adds one change. Scores are against the dataset&apos;s ground truth, pooled over {R.dataset.units} districts.
        </div>
        <div style={{ height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ladder} layout="vertical" margin={{ left: 8, right: 24 }} barGap={2}>
              <CartesianGrid horizontal={false} stroke="#e4e3df" />
              <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="step" width={300} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => v.toFixed(2)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Precision" fill={NAVY} radius={[0, 3, 3, 0]} />
              <Bar dataKey="Recall" fill={ORANGE} radius={[0, 3, 3, 0]} />
              <Bar dataKey="F1" fill={TEAL} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <RealDataResearch />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Loudness bias */}
        <Card className="p-4">
          <div className="text-sm font-semibold">Loudness bias</div>
          <div className="text-xs text-muted-foreground mb-2">
            The cut-off districts hold a large share of the expected need but wrote almost none of the need posts.
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={loudness} margin={{ left: 0, right: 12 }}>
                <CartesianGrid vertical={false} stroke="#e4e3df" />
                <XAxis dataKey="event" tick={{ fontSize: 11 }} />
                <YAxis unit="%" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Share of expected need" fill={NAVY} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Share of need posts" fill={ORANGE} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Ranking */}
        <Card className="p-4">
          <div className="text-sm font-semibold">Which single signal ranks cut-off districts first?</div>
          <div className="text-xs text-muted-foreground mb-2">
            Ranking AUC, mean of three events. Cell-site reports rank perfectly here; as a flagging rule, outage evidence
            alone raises {evidenceOnly?.fp} false alarms, and the social shortfall removes them.
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranking} layout="vertical" margin={{ left: 8, right: 28 }}>
                <CartesianGrid horizontal={false} stroke="#e4e3df" />
                <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => v.toFixed(2)} />
                <ReferenceLine x={0.5} stroke="#52514e" strokeDasharray="4 3" label={{ value: "random", fontSize: 10, position: "top" }} />
                <Bar dataKey="auc" name="AUC" radius={[0, 3, 3, 0]} label={{ position: "right", fontSize: 11, formatter: (v: number) => v.toFixed(2) }}>
                  {ranking.map((r) => (
                    <Cell key={r.name} fill={r.kind === "social" ? TEAL : r.kind === "evidence" ? NAVY : GREY} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Pipeline stages */}
      <Card className="p-4">
        <div className="text-sm font-semibold mb-2">How well does each pipeline stage work?</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-left text-muted-foreground">
              <tr><th className="py-1.5 pr-3 font-semibold">Stage</th><th className="py-1.5 pr-3 font-semibold">Result</th><th className="py-1.5 font-semibold">Note</th></tr>
            </thead>
            <tbody>
              {R.classifiers.map((c) => (
                <Row key={c.name} stage={`Need classifier — ${c.name}`} result={`F1 ${c.relevance_f1.toFixed(2)} relevance · ${c.need_f1.toFixed(2)} needs`} note={c.note} />
              ))}
              <Row stage="Incident location" result={`${pct(R.geolocation.incident_location_accuracy)} correct`} note={`Using the author's location instead: ${pct(R.geolocation.author_location_would_be_correct)} correct`} />
              <Row stage="Reposts" result={`F1 ${R.dedupe.amplification.f1.toFixed(2)}`} note={`${R.dedupe.amplification.tp.toLocaleString()} reposts removed`} />
              <Row stage="Copy-pasted re-shares" result={`precision ${R.dedupe.copies.precision.toFixed(2)} · recall ${R.dedupe.copies.recall.toFixed(2)}`} note="Copies without a 'Sharing:' prefix are missed" />
              <Row stage="Scam accounts" result={`${R.dedupe.spam_accounts.tp} of ${R.dedupe.spam_accounts.n_gold_bot_accounts} found, ${R.dedupe.spam_accounts.fp} wrongly`} note="From link text, account age and follower count" />
              <Row stage="Counting people, not posts" result={`posts overcount reports ${R.dedupe.inflation.posts_per_independent_report}×`} note={`${R.dedupe.inflation.relevant_posts.toLocaleString()} need posts → ${R.dedupe.inflation.independent_reports_gold.toLocaleString()} independent reports`} />
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Network */}
        <Card className="p-4">
          <div className="text-sm font-semibold">Network analysis</div>
          <div className="text-xs text-muted-foreground mb-2">
            Who reposts whom. Attention concentrates on connected places; coordinated scam accounts form tight clusters.
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-left text-muted-foreground">
              <tr>
                <th className="py-1.5 font-semibold">Event</th>
                <th className="py-1.5 font-semibold text-right">Accounts</th>
                <th className="py-1.5 font-semibold text-right">Repost links</th>
                <th className="py-1.5 font-semibold text-right">Reposts to Silent Zones</th>
                <th className="py-1.5 font-semibold text-right">Scam cluster</th>
              </tr>
            </thead>
            <tbody>
              {net.map(([ev, n]) => (
                <tr key={ev} className="border-t">
                  <td className="py-1.5">{ev}</td>
                  <td className="py-1.5 text-right font-mono">{n.amplification_nodes}</td>
                  <td className="py-1.5 text-right font-mono">{n.amplification_edges}</td>
                  <td className="py-1.5 text-right font-mono">{pct(n.reposts_to_true_silent_zones_share, 1)}</td>
                  <td className="py-1.5 text-right font-mono">{n.coordination_nodes} accounts</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-xs text-muted-foreground mt-2">
            A few accounts receive most reposts (inequality index {net.map(([, n]) => n.gini_in_degree.toFixed(2)).join(" / ")}). The
            repost graph magnifies loudness bias; it does not correct it.
          </div>
        </Card>

        {/* Need pairs */}
        <Card className="p-4">
          <div className="text-sm font-semibold">Needs that appear together</div>
          <div className="text-xs text-muted-foreground mb-2">
            Lift above 1 means the pair occurs more often than chance. Phone network + missing people is the
            &quot;can&apos;t reach my family&quot; signature.
          </div>
          <div className="space-y-1.5">
            {R.cooccurrence.map((c) => (
              <div key={c.pair} className="flex items-center gap-2 text-sm">
                <span className="w-40 capitalize">{c.pair.replace("+", " + ")}</span>
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (c.lift / 5) * 100)}%`, backgroundColor: TEAL }} />
                </div>
                <span className="w-24 text-right font-mono text-xs">lift {c.lift.toFixed(1)} · {c.posts}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Among posts written about a district from elsewhere, {pct(R.echo.mean_echo_share_true_silent)} were of this kind for
            Silent Zones, against {pct(R.echo.mean_echo_share_other)} for other districts.
          </div>
        </Card>
      </div>

      {/* Ablation */}
      <Card className="p-4">
        <div className="text-sm font-semibold mb-2">What happens if one design choice is removed?</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-left text-muted-foreground">
              <tr>
                <th className="py-1.5 font-semibold">Variant</th>
                <th className="py-1.5 font-semibold text-right">Found</th>
                <th className="py-1.5 font-semibold text-right">False alarms</th>
                <th className="py-1.5 font-semibold text-right">F1</th>
                <th className="py-1.5 pl-3 font-semibold w-1/3">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {R.ablation.map((a, i) => (
                <tr key={a.name} className={`border-t ${i === 0 ? "font-semibold" : ""}`}>
                  <td className="py-1.5">{a.name}</td>
                  <td className="py-1.5 text-right font-mono">{a.tp} / {total}</td>
                  <td className="py-1.5 text-right font-mono">{a.fp}</td>
                  <td className="py-1.5 text-right font-mono">{a.f1.toFixed(2)}</td>
                  <td className="py-1.5 pl-3">
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${a.f1 * 100}%`, backgroundColor: i === 0 ? TEAL : GREY }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          Across {R.sensitivity.configs} threshold settings, F1 stayed between {R.sensitivity.f1_min.toFixed(2)} and{" "}
          {R.sensitivity.f1_max.toFixed(2)} (median {R.sensitivity.f1_median.toFixed(2)}).
        </div>
      </Card>

      {/* Limits */}
      <Card className="p-4 border-amber-300 bg-amber-50/60">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed">
            <div className="font-semibold mb-1">Read these numbers with care</div>
            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
              <li>The original detector results use simulated posts and outcomes. The separately labelled HumAID section tests real-post classification only.</li>
              <li>Every step after the prototype was designed after seeing results on this dataset, so the final score is optimistic.</li>
              <li>With {total} true Silent Zones, one district moves recall by {Math.round(100 / total)} points.</li>
              <li>Flags are advisory. A person must verify before acting.</li>
            </ul>
            <div className="mt-2 flex gap-1.5 flex-wrap">
              <Badge variant="secondary">Clean estimate: prototype F1 {proto.f1.toFixed(2)}</Badge>
              <Badge variant="secondary">Clean estimate: classifier on an unseen event {R.classifiers[1].relevance_f1.toFixed(2)}</Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Tile({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <Card className={`p-3 ${accent ? "border-accent/50 bg-accent/5" : ""}`}>
      <div className="text-2xl font-bold tabular-nums leading-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </Card>
  );
}

function Row({ stage, result, note }: { stage: string; result: string; note: string }) {
  return (
    <tr className="border-t align-top">
      <td className="py-1.5 pr-3">{stage}</td>
      <td className="py-1.5 pr-3 font-mono text-xs whitespace-nowrap">{result}</td>
      <td className="py-1.5 text-muted-foreground">{note}</td>
    </tr>
  );
}
