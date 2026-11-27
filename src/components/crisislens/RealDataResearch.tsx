"use client";

import evidence from "@/lib/crisislens/data/realdata.json";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

// Added evaluations, each labelled "real" or "simulated":
//  - robustness of the main-dataset result (bootstrap intervals, detection timeline)
//  - classifier on real HumAID tweets (partial test)
//  - pre-registered partial test of loudness on real tweets
//  - real evidence sources that are still blocked
const MODEL: Record<string, string> = {
  v1: "Original keyword list",
  v2: "Revised keyword list",
  tfidf_lr: "Trained model",
};
const EVENT: Record<string, string> = {
  hurricane_maria_2017: "Maria 2017",
  kerala_floods_2018: "Kerala 2018",
};

function Tag({ real }: { real: boolean }) {
  return (
    <Badge variant={real ? "default" : "secondary"} className="text-[10px] uppercase tracking-wide">
      {real ? "Real data" : "Simulated data"}
    </Badge>
  );
}

export function RealDataResearch() {
  const real = evidence.phase1.rows.filter((r) => r.domain === "real");
  const u = evidence.uncertainty;
  const s = evidence.silence;
  const e2 = evidence.evidence;
  const ci = (m: { point: number; ci_low: number; ci_high: number }) =>
    `${m.point.toFixed(2)} (${m.ci_low.toFixed(2)}–${m.ci_high.toFixed(2)})`;

  return (
    <>
      {/* Robustness */}
      {u && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold">How solid is the main result?</div>
            <Tag real={false} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-2">
                Scores with 95% intervals, from resampling the 42 districts {u.bootstrap_draws.toLocaleString()} times.
                The method was not changed.
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-left text-muted-foreground">
                  <tr>
                    <th className="py-1.5 font-semibold">Method</th>
                    <th className="py-1.5 font-semibold">Precision</th>
                    <th className="py-1.5 font-semibold">Recall</th>
                    <th className="py-1.5 font-semibold">F1</th>
                  </tr>
                </thead>
                <tbody>
                  {([["Final method", u.bootstrap.final_method], ["Original prototype", u.bootstrap.prototype_v1]] as const).map(
                    ([name, m]) => (
                      <tr key={name} className="border-t">
                        <td className="py-1.5">{name}</td>
                        <td className="py-1.5 font-mono text-xs">{ci(m.precision)}</td>
                        <td className="py-1.5 font-mono text-xs">{ci(m.recall)}</td>
                        <td className="py-1.5 font-mono text-xs">{ci(m.f1)}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              <div className="text-xs text-muted-foreground mt-2">
                The intervals are wide and overlap: with 10 true Silent Zones, one district matters a lot. They do not
                remove the optimism from tuning on this dataset. A check on freshly generated data is blocked: the
                generator script is missing.
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                How early can a Silent Zone be seen? The same method, with the window cut short.
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={u.timeline.per_hour} margin={{ left: 0, right: 16, top: 8 }}>
                    <CartesianGrid stroke="#e4e3df" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} unit="h" />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="found" name="True Silent Zones found (of 10)" stroke="#0097a7" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="false_alarms" name="False alarms" stroke="#eb6834" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="text-xs text-muted-foreground">
                Hours after impact. The impact day&apos;s outage evidence is treated as available from hour 6, which is generous.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Real tweets: classifier */}
      <Card className="p-4 space-y-3" aria-label="Real data evaluation">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-semibold">Does the classifier work on real tweets?</div>
          <Tag real />
          <Badge variant="outline" className="text-[10px]">Partial test</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          HumAID: {evidence.phase1.posts.toLocaleString()} real, human-labelled tweets from 19 disasters. Each classifier
          is scored on a disaster the trained model never saw. F1 for telling a need report from other posts.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-left text-muted-foreground">
              <tr>
                {["Real event", "Classifier", "Tweets scored", "Precision", "Recall", "F1", ""].map((x) => (
                  <th key={x} className="py-1.5 pr-3 font-semibold">{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {real.map((r) => (
                <tr className="border-t" key={`${r.event}-${r.model}`}>
                  <td className="py-1.5 pr-3">{EVENT[r.event] ?? r.event}</td>
                  <td className="py-1.5 pr-3">{MODEL[r.model] ?? r.model}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{r.n.toLocaleString()}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{r.precision.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{r.recall.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs font-semibold">{r.f1.toFixed(2)}</td>
                  <td className="py-1.5 w-1/4">
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${r.f1 * 100}%`, backgroundColor: r.model === "tfidf_lr" ? "#0097a7" : "#a3a29c" }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          The revised keyword list scored 1.00 on the simulated posts and far lower here: it was fitted to the
          simulation. Real posts need a trained classifier. HumAID labels are topics, not needs, so about a quarter of
          each event&apos;s tweets can be scored. This does not test the ten needs, urgency, or Silent Zone detection.{" "}
          <a className="underline" href="https://doi.org/10.1609/icwsm.v15i1.18116" target="_blank" rel="noreferrer">
            Alam et al., ICWSM 2021
          </a>
        </p>
      </Card>

      {/* Real tweets: pre-registered partial test */}
      {s && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold">Pre-registered test: does real tweet volume follow population?</div>
            <Tag real />
            <Badge variant="outline" className="text-[10px]">Partial test · hypothesis not supported</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {s.events.map((e) => {
              const max = Math.max(...e.districts.map((d) => d.located_tweets), 1);
              return (
                <div key={e.event} className="rounded-md border p-3">
                  <div className="text-sm font-semibold">{e.event}</div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {e.located.toLocaleString()} of {e.tweets.toLocaleString()} tweets name one of 14 districts · rank
                    correlation with population {e.spearman_rho_volume_vs_population.toFixed(2)} (p = {e.p_value.toFixed(2)})
                  </div>
                  <div className="space-y-1">
                    {e.districts.slice(0, 7).map((d) => (
                      <div key={d.district} className="flex items-center gap-2 text-xs">
                        <span className="w-28 truncate">{d.district}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(d.located_tweets / max) * 100}%` }} />
                        </div>
                        <span className="w-8 text-right font-mono">{d.located_tweets}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {s.conclusion} The test was written down before it was run. A real Silent Zone test is not possible yet:
            these tweets have no pre-disaster baseline and no author locations, so mentions of a place cannot be told
            from voices from it.
          </p>
        </Card>
      )}

      {/* Blocked sources */}
      {e2 && (
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">Real outage evidence: not yet obtained</div>
          <div className="space-y-2">
            {e2.sources.map((src) => (
              <div key={src.name} className="text-sm flex items-start gap-2">
                <Badge variant="secondary" className="text-[10px] mt-0.5 flex-shrink-0">{src.status}</Badge>
                <div>
                  <span className="font-semibold">{src.name}.</span>{" "}
                  <span className="text-muted-foreground">{src.reason}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-2">{e2.note}</div>
        </Card>
      )}
    </>
  );
}
