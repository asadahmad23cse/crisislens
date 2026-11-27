"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, MapPin, User, Repeat2, ShieldAlert, Sparkles, ArrowRight, Upload } from "lucide-react";
import {
  analyzePost,
  decide,
  inputsOf,
  UNITS,
  NEED_LABEL,
  EVENT_LABEL,
  STATUS_LABEL,
  type PostAnalysis,
} from "@/lib/crisislens/live";

const EXAMPLES: { label: string; text: string; location: string }[] = [
  { label: "Rescue request", text: "People trapped under rubble in Barpak, Gorkha. Please send rescue teams now!", location: "Gorkha" },
  { label: "Posted from abroad", text: "Can't reach my family in Utuado since Maria. Anyone have news?", location: "Washington, DC" },
  { label: "All clear", text: "Power is back in Aluva, Ernakulam. No need to send generators here", location: "Ernakulam" },
  { label: "Spanish", text: "Personas atrapadas en Rio Piedras, San Juan. Necesitamos rescate urgente", location: "San Juan" },
  { label: "Nepali", text: "Kathmandu ma khana ra pani chhaina, sahayog garnuhos", location: "Kathmandu" },
  { label: "Evacuee", text: "We were evacuated from Kuttanad, Alappuzha. Now at the relief camp in Kollam town, Kollam. Need clothes and food", location: "Kerala" },
  { label: "Repost", text: "RT @user12: Hospital in Humacao running out of supplies after Maria. Need bandages, antibiotics, IV fluids", location: "Ponce" },
  { label: "Scam link", text: "Click to donate for flood victims in Idukki bit.ly/3fa9c1", location: "" },
  { label: "Prayer, not a report", text: "Praying for everyone affected by the earthquake in Sindhupalchok", location: "Delhi" },
];

const URGENCY = ["Not a need report", "Concerning", "Urgent", "Life-threatening"];
const URGENCY_COLOR = ["#94a3b8", "#eab308", "#f97316", "#b91c1c"];

// Reads a CSV or plain-text file into one post per line. For a CSV with a header
// that has a "text" column (also tweet_text, post, message, content), that column
// is used; otherwise each line is treated as one post. Quoted fields are handled.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function postsFromFile(content: string): { posts: string[]; column: string | null } {
  const rows = content.split(/\r?\n/).filter((l) => l.trim());
  if (rows.length === 0) return { posts: [], column: null };
  const header = parseCsvLine(rows[0]).map((h) => h.trim().toLowerCase());
  const idx = header.findIndex((h) => ["text", "tweet_text", "post", "message", "content"].includes(h));
  if (idx < 0) return { posts: rows, column: null };
  return {
    posts: rows.slice(1).map((r) => (parseCsvLine(r)[idx] ?? "").replace(/\s+/g, " ").trim()).filter(Boolean),
    column: header[idx],
  };
}

const MAX_POSTS = 2000;

interface Props {
  eventId: string;
}

export function AnalyzeView({ eventId }: Props) {
  const [text, setText] = useState(EXAMPLES[0].text);
  const [location, setLocation] = useState(EXAMPLES[0].location);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const { posts, column } = postsFromFile(await file.text());
    setText(posts.slice(0, MAX_POSTS).join("\n"));
    setLocation("");
    setUploadNote(
      posts.length === 0
        ? `No posts found in ${file.name}.`
        : `${file.name}: ${Math.min(posts.length, MAX_POSTS).toLocaleString()} posts loaded` +
          (column ? ` from the "${column}" column` : ", one per line") +
          (posts.length > MAX_POSTS ? ` (first ${MAX_POSTS.toLocaleString()} of ${posts.length.toLocaleString()})` : "") +
          ".",
    );
  };

  const lines = useMemo(() => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, MAX_POSTS), [text]);
  const results = useMemo(() => lines.map((l) => analyzePost(l, location, eventId)), [lines, location, eventId]);
  const single = results.length === 1 ? results[0] : null;

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-primary to-[#1a4060] text-primary-foreground p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-primary-foreground/70 font-semibold mb-1">
              Try it — analyse a post live
            </div>
            <div className="text-base md:text-lg font-semibold leading-snug">
              Type or paste a disaster post. CrisisLens reads it the same way the pipeline reads all 23,387.
            </div>
            <div className="text-sm text-primary-foreground/80 mt-1">
              Paste several posts, one per line, to get a summary table. Nothing is sent anywhere: the analysis runs in your browser.
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Input */}
        <Card className="p-4 lg:col-span-2 space-y-3">
          <div>
            <label htmlFor="post-text" className="text-sm font-semibold">Post text</label>
            <Textarea
              id="post-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="mt-1.5 text-sm"
              placeholder="e.g. No signal in Chautara, Sindhupalchok. Cell tower down, can't call anyone"
            />
          </div>
          <div>
            <label htmlFor="post-loc" className="text-sm font-semibold">Author&apos;s profile location <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Input
              id="post-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-1.5 text-sm"
              placeholder="e.g. Kathmandu, or London"
            />
          </div>
          <div>
            <label htmlFor="post-file" className="text-sm font-semibold">Or upload a file of posts</label>
            <div className="mt-1.5 flex items-center gap-2">
              <Button asChild size="sm" variant="outline" className="h-8">
                <label htmlFor="post-file" className="cursor-pointer">
                  <Upload className="w-3.5 h-3.5 mr-1" /> Choose CSV or text file
                </label>
              </Button>
              <input
                id="post-file"
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="sr-only"
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
              {uploadNote ?? "A CSV needs a column named text. The file stays in your browser."}
              {" "}Uploads get needs, urgency and location. A Silent Zone decision is not computed for them, because that
              needs each district's normal activity before the disaster.
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">Examples</div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <Button
                  key={ex.label}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setText(ex.text);
                    setLocation(ex.location);
                  }}
                >
                  {ex.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Result */}
        <div className="lg:col-span-3 space-y-3">
          {results.length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground text-center">Type a post to see how it is read.</Card>
          )}
          {single && <SingleResult a={single} />}
          {results.length > 1 && <BatchResult results={results} />}
        </div>
      </div>
    </div>
  );
}

function SingleResult({ a }: { a: PostAnalysis }) {
  const unit = a.unit ? UNITS.find((u) => u.id === a.unit!.id) : undefined;
  const before = unit ? decide(inputsOf(unit)) : null;
  const addsVoice = a.countsAs === "local voice";
  const after = unit && addsVoice
    ? decide({
        ...inputsOf(unit),
        observed: unit.observed + 1,
        needVoices: unit.need_voices + (a.relevant ? 1 : 0),
      })
    : null;

  return (
    <>
      <Card className="p-4 space-y-4">
        {/* Verdict */}
        <div className="flex items-start gap-3">
          {a.relevant ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-6 h-6 text-slate-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <div className="text-lg font-semibold leading-tight">
              {a.relevant ? "A need report" : "Not a need report"}
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {a.relevant
                ? "It describes a need on the ground."
                : a.negated
                  ? `It says the need is over: “${a.negated}”.`
                  : a.veto
                    ? `It mentions the disaster but is not a first-hand report: “${a.veto}”.`
                    : "No need wording was found."}
            </div>
          </div>
        </div>

        {/* Needs */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Needs found</div>
          {a.needs.length === 0 ? (
            <div className="text-sm text-muted-foreground">None</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {a.needs.map((n) => (
                <div
                  key={n.need}
                  className={`rounded-md border px-2.5 py-1.5 text-sm ${a.relevant ? "bg-accent/5 border-accent/40" : "bg-muted/40 opacity-70"}`}
                >
                  <span className="font-semibold">{NEED_LABEL[n.need]}</span>
                  <span className="text-muted-foreground"> · matched “{n.cue}”</span>
                </div>
              ))}
            </div>
          )}
          {!a.relevant && a.needs.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1.5">
              Need words were found but do not count, for the reason above.
            </div>
          )}
        </div>

        {/* Urgency */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Urgency</div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[1, 2, 3].map((lvl) => (
                <div
                  key={lvl}
                  className="w-10 h-2.5 rounded-full"
                  style={{ backgroundColor: a.urgency >= lvl ? URGENCY_COLOR[a.urgency] : "#e2e8f0" }}
                />
              ))}
            </div>
            <span className="text-sm font-semibold">{a.urgency} of 3 · {URGENCY[a.urgency]}</span>
          </div>
        </div>

        {/* Where and who */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-md border p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" /> Where the incident is
            </div>
            {a.unit ? (
              <>
                <div className="text-base font-semibold mt-1">{a.unit.name}</div>
                <div className="text-xs text-muted-foreground">
                  {EVENT_LABEL[a.eventId!]} · found “{a.place}” in the text
                  {a.locationRule !== "text" ? ` · ${a.locationRule}` : ""}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground mt-1">No district from the three events is named.</div>
            )}
          </div>
          <div className="rounded-md border p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <User className="w-3.5 h-3.5" /> Where the author is
            </div>
            <div className="text-base font-semibold mt-1 first-letter:uppercase">{a.authorKind}</div>
            <div className="text-xs text-muted-foreground">
              The need is placed where the incident is, not where the author is.
            </div>
          </div>
        </div>

        {/* Flags */}
        {(a.amplification || a.copy || a.spamText) && (
          <div className="flex flex-wrap gap-2">
            {a.amplification && (
              <Badge variant="secondary" className="gap-1"><Repeat2 className="w-3 h-3" /> Repost</Badge>
            )}
            {a.copy && <Badge variant="secondary" className="gap-1"><Repeat2 className="w-3 h-3" /> Manual re-share</Badge>}
            {a.spamText && (
              <Badge variant="destructive" className="gap-1"><ShieldAlert className="w-3 h-3" /> Scam / donation link</Badge>
            )}
          </div>
        )}

        {/* Counting */}
        <div className="rounded-md bg-muted/40 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">How it is counted</div>
          <div className="text-sm font-semibold mt-1 first-letter:uppercase">{a.countsAs}</div>
          <div className="text-sm text-muted-foreground">{a.reason}</div>
        </div>
      </Card>

      {/* District context */}
      {unit && before && (
        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold">
            {unit.name} in the dataset
            <span className="font-normal text-muted-foreground"> · first 72 hours</span>
          </div>
          <VoiceBar label="Expected local voices" value={before.mu} max={Math.max(before.mu, unit.observed + 1)} color="#0f2c4e" />
          <VoiceBar label="Heard" value={unit.observed} max={Math.max(before.mu, unit.observed + 1)} color="#0097a7" />
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Badge variant={before.status === "silent_zone" ? "destructive" : "secondary"}>{STATUS_LABEL[before.status]}</Badge>
            {after && (
              <>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">with this post ({unit.observed + 1} heard):</span>
                <Badge variant={after.status === "silent_zone" ? "destructive" : "secondary"}>{STATUS_LABEL[after.status]}</Badge>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            {after
              ? after.status === before.status
                ? "One more voice does not change the decision: the district is judged on how far it sits below its own normal, not on single posts."
                : "This one voice changes the decision, which shows how thin the evidence is for a district this small."
              : "This post does not add a local voice, so the district's count is unchanged."}
          </div>
        </Card>
      )}
    </>
  );
}

function VoiceBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">{Number.isInteger(value) ? value : value.toFixed(1)}</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / Math.max(max, 1)) * 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function BatchResult({ results }: { results: PostAnalysis[] }) {
  const relevant = results.filter((r) => r.relevant);
  const needCounts = new Map<string, number>();
  for (const r of relevant) for (const n of r.needs) needCounts.set(n.need, (needCounts.get(n.need) ?? 0) + 1);
  const byUnit = new Map<string, number>();
  for (const r of relevant) if (r.unit) byUnit.set(r.unit.name, (byUnit.get(r.unit.name) ?? 0) + 1);
  const top = [...needCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxNeed = Math.max(1, ...top.map((t) => t[1]));

  return (
    <>
      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Posts read" value={results.length} />
          <Stat label="Need reports" value={relevant.length} />
          <Stat label="Life-threatening" value={results.filter((r) => r.urgency === 3).length} />
          <Stat label="Not counted" value={results.filter((r) => r.countsAs === "not counted").length} />
        </div>
        {top.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs</div>
            {top.map(([need, n]) => (
              <div key={need} className="flex items-center gap-2 text-sm">
                <span className="w-28 text-muted-foreground">{NEED_LABEL[need]}</span>
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(n / maxNeed) * 100}%` }} />
                </div>
                <span className="w-6 text-right font-mono">{n}</span>
              </div>
            ))}
          </div>
        )}
        {byUnit.size > 0 && (
          <div className="mt-3 text-sm text-muted-foreground">
            Districts: {[...byUnit.entries()].sort((a, b) => b[1] - a[1]).map(([u, n]) => `${u} (${n})`).join(", ")}
          </div>
        )}
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-left sticky top-0">
              <tr>
                <th className="p-2 font-semibold">Post</th>
                <th className="p-2 font-semibold">Needs</th>
                <th className="p-2 font-semibold">Urgency</th>
                <th className="p-2 font-semibold">District</th>
                <th className="p-2 font-semibold">Counted as</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 300).map((r, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="p-2 max-w-xs">{r.text}</td>
                  <td className="p-2">{r.relevant ? r.needs.map((n) => NEED_LABEL[n.need]).join(", ") : "—"}</td>
                  <td className="p-2 font-mono">{r.urgency}</td>
                  <td className="p-2">{r.unit?.name ?? "—"}</td>
                  <td className="p-2">{r.countsAs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {results.length > 300 && (
          <div className="p-2 text-xs text-muted-foreground border-t">
            Showing the first 300 of {results.length.toLocaleString()} posts. The totals above cover all of them.
          </div>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
