"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EventOption {
  event_id: string;
  name: string;
  hazard_type: string;
  country: string;
}

interface Props {
  events: EventOption[];
  currentEventId: string;
  onSelect: (eventId: string) => void;
}

const HAZARD_LABELS: Record<string, string> = {
  earthquake: "🌍 Earthquake",
  cyclone: "🌀 Cyclone",
  flood: "🌊 Flood",
};

export function EventSelector({ events, currentEventId, onSelect }: Props) {
  return (
    <Select value={currentEventId} onValueChange={onSelect}>
      <SelectTrigger className="w-[280px] h-9">
        <SelectValue placeholder="Select event" />
      </SelectTrigger>
      <SelectContent>
        {events.map((e) => (
          <SelectItem key={e.event_id} value={e.event_id}>
            <span className="mr-1.5">{HAZARD_LABELS[e.hazard_type] ?? "📍"}</span>
            <span>{e.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
