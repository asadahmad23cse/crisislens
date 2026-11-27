"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Filter, ArrowUpDown, ArrowUp, ArrowDown, Users, MessageSquare, ShieldAlert } from "lucide-react";
import type { NeedUnit, NeedType } from "@/lib/crisislens/pipeline/types";
import {
  NEED_TYPES,
  NEED_TYPE_COLORS,
  NEED_TYPE_LABELS,
  NEED_TYPE_SHORT,
  URGENCY_LABELS,
} from "@/lib/crisislens/pipeline/types";

interface Props {
  needUnits: NeedUnit[];
  onUnitClick?: (unitId: string) => void;
}

type SortKey = "n_unique_authors" | "n_posts" | "peak_urgency" | "corroboration_score" | "first_seen";

export function NeedLedger({ needUnits, onUnitClick }: Props) {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUnit, setFilterUnit] = useState<string>("all");
  const [filterMinUrgency, setFilterMinUrgency] = useState<string>("0");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("n_unique_authors");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const adminUnits = useMemo(() => {
    const s = new Set(needUnits.map((nu) => nu.admin_unit_id));
    return [...s].map((id) => ({
      id,
      name: needUnits.find((nu) => nu.admin_unit_id === id)?.admin_unit_name ?? id,
    }));
  }, [needUnits]);

  const filtered = useMemo(() => {
    let r = needUnits.slice();
    if (filterType !== "all") r = r.filter((nu) => nu.need_types.includes(filterType as NeedType));
    if (filterUnit !== "all") r = r.filter((nu) => nu.admin_unit_id === filterUnit);
    const minU = parseInt(filterMinUrgency, 10);
    if (minU > 0) r = r.filter((nu) => nu.peak_urgency >= minU);
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter((nu) => nu.representative_text.toLowerCase().includes(s));
    }
    r.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc"
        ? (va as number) - (vb as number)
        : (vb as number) - (va as number);
    });
    return r;
  }, [needUnits, filterType, filterUnit, filterMinUrgency, search, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  function renderSortIcon(k: SortKey) {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-30" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 inline ml-1" />
    );
  }

  function exportCsv(hxlTagged: boolean = false) {
    const rows = filtered;
    const header = hxlTagged
      ? ["#need_type+list", "#adm2+name", "#affected+unique_authors+num", "#affected+posts+num", "#status+urgency+code", "#date+first_seen", "#date+last_seen", "#reliability+corroboration+pct", "#description+text"]
      : ["need_types", "admin_unit_name", "n_unique_authors", "n_posts", "peak_urgency", "first_seen", "last_seen", "corroboration_score", "representative_text"];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [
          JSON.stringify(r.need_types.map((t) => NEED_TYPE_SHORT[t]).join("; ")),
          JSON.stringify(r.admin_unit_name),
          r.n_unique_authors,
          r.n_posts,
          r.peak_urgency,
          r.first_seen,
          r.last_seen,
          r.corroboration_score,
          JSON.stringify(r.representative_text),
        ].join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = hxlTagged ? "crisislens_need_ledger_hxl.csv" : "crisislens_need_ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Filter className="w-4 h-4 text-muted-foreground" />
          Filters
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Need type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All need types</SelectItem>
            {NEED_TYPES.map((nt) => (
              <SelectItem key={nt} value={nt}>
                {NEED_TYPE_LABELS[nt]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterUnit} onValueChange={setFilterUnit}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Admin unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All admin units</SelectItem>
            {adminUnits.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMinUrgency} onValueChange={setFilterMinUrgency}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Min urgency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any urgency</SelectItem>
            <SelectItem value="1">Concerning+</SelectItem>
            <SelectItem value="2">Urgent+</SelectItem>
            <SelectItem value="3">Life-threatening only</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Search text..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[200px] h-9"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCsv(false)}>
            <Download className="w-3.5 h-3.5 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCsv(true)}>
            <Download className="w-3.5 h-3.5 mr-1" /> HXL CSV
          </Button>
        </div>
      </div>

      <div className="rounded-md border max-h-[480px] overflow-y-auto crisisislens-scroll">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[260px]">Need Type</TableHead>
              <TableHead>Admin Unit</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("n_unique_authors")}>
                <Users className="w-3.5 h-3.5 inline mr-1" />
                Unique Authors
                {renderSortIcon("n_unique_authors")}
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("n_posts")}>
                <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
                Posts
                {renderSortIcon("n_posts")}
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("peak_urgency")}>
                <ShieldAlert className="w-3.5 h-3.5 inline mr-1" />
                Urgency
                {renderSortIcon("peak_urgency")}
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("corroboration_score")}>
                Corroboration
                {renderSortIcon("corroboration_score")}
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("first_seen")}>
                First Seen
                {renderSortIcon("first_seen")}
              </TableHead>
              <TableHead className="min-w-[280px]">Representative Text</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 100).map((nu) => (
              <TableRow
                key={nu.need_unit_id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => onUnitClick?.(nu.admin_unit_id)}
              >
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {nu.need_types.slice(0, 3).map((nt) => (
                      <span
                        key={nt}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                        style={{ backgroundColor: NEED_TYPE_COLORS[nt] }}
                      >
                        {NEED_TYPE_SHORT[nt]}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{nu.admin_unit_name}</TableCell>
                <TableCell className="font-semibold tabular-nums">{nu.n_unique_authors}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{nu.n_posts}</TableCell>
                <TableCell>
                  <UrgencyBadge urgency={nu.peak_urgency} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${nu.corroboration_score * 100}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {Math.round(nu.corroboration_score * 100)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {new Date(nu.first_seen).toISOString().slice(0, 16).replace("T", " ")}
                </TableCell>
                <TableCell className="text-xs italic text-muted-foreground max-w-[280px]">
                  "{nu.representative_text}"
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No Need Units match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {Math.min(100, filtered.length)} of {filtered.length} filtered units
          {filtered.length !== needUnits.length && ` (out of ${needUnits.length} total)`}
        </span>
        <span>n_unique_authors is the load-bearing count · n_posts is diagnostic</span>
      </div>
    </Card>
  );
}

function UrgencyBadge({ urgency }: { urgency: 0 | 1 | 2 | 3 }) {
  const colors = ["#6b7280", "#f59e0b", "#ea580c", "#d32f2f"];
  const labels = ["Info", "Concerning", "Urgent", "Life-threat"];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold text-white"
      style={{ backgroundColor: colors[urgency] }}
    >
      {labels[urgency]}
    </span>
  );
}
