"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface Props {
  eventId: string;
  eventName: string;
}

type Audience = "eoc" | "cluster_lead" | "ngo_field" | "researcher";

const AUDIENCES: { id: Audience; label: string; description: string }[] = [
  { id: "eoc", label: "EOC Analyst", description: "Emergency Operations Center — deciding where to send assessment teams" },
  { id: "cluster_lead", label: "Cluster Lead", description: "Humanitarian cluster lead (WASH, Health, Shelter)" },
  { id: "ngo_field", label: "NGO Field", description: "NGO field coordinator about to deploy" },
  { id: "researcher", label: "Researcher", description: "Crisis informatics researcher reproducing the method" },
];

interface BriefResponse {
  brief: string;
  audience: string;
  generated_at: string;
  event_id: string;
  word_count: number;
  fallback?: boolean;
  error?: string;
  context_summary?: any;
}

export function BriefView({ eventId, eventName }: Props) {
  const [audience, setAudience] = useState<Audience>("eoc");
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateBrief() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/events/${eventId}/brief`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audience, max_words: 450 }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: BriefResponse = await r.json();
      setBrief(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate brief");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Intro */}
      <Card className="p-4 bg-muted/30 border-amber-300">
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-foreground/80">
            <strong>LLM-generated analyst brief.</strong> Auto-generated situation
            report using the z-ai-web-dev-sdk. Per PRD §6.2, an LLM is allowed
            for UI-facing rationale text — never in the classification path.
            The brief is grounded in the structured pipeline output (silent zones,
            critical needs, validation metrics) and never invents numbers.
          </div>
        </div>
      </Card>

      {/* Audience selector */}
      <Card className="p-4">
        <div className="text-sm font-semibold mb-2">Select audience</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {AUDIENCES.map((a) => (
            <button
              key={a.id}
              onClick={() => setAudience(a.id)}
              className={`text-left p-2.5 rounded-md border transition-colors ${
                audience === a.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border"
              }`}
            >
              <div className="text-xs font-semibold">{a.label}</div>
              <div className={`text-[10px] mt-0.5 ${audience === a.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {a.description}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button onClick={generateBrief} disabled={loading} size="sm">
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Generating...
              </>
            ) : brief ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Regenerate brief
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5 mr-1" />
                Generate analyst brief
              </>
            )}
          </Button>
          {brief && (
            <Badge variant="secondary" className="text-[10px]">
              {brief.word_count} words
            </Badge>
          )}
          {brief?.fallback && (
            <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-400">
              Rule-based fallback (LLM unavailable)
            </Badge>
          )}
        </div>
      </Card>

      {/* Error */}
      {error && (
        <Card className="p-3 bg-destructive/5 border-destructive/40">
          <div className="text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        </Card>
      )}

      {/* Brief */}
      {brief && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">
                Situation Report — {eventName}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {new Date(brief.generated_at).toISOString().slice(0, 19).replace("T", " ")} UTC · audience: {brief.audience}
            </div>
          </div>
          <div className="prose prose-sm max-w-none">
            {brief.brief.split(/\n\n+/).map((para, i) => (
              <p key={i} className="text-sm leading-relaxed text-foreground/90 mb-3">
                {para}
              </p>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t text-[11px] text-muted-foreground flex items-start gap-2">
            <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5 text-emerald-600" />
            <span>
              Brief grounded in structured pipeline output: silent zones, critical
              unmet needs, co-occurrence patterns, and validation metrics.
              All numbers come from the pipeline — the LLM only composes prose.
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
