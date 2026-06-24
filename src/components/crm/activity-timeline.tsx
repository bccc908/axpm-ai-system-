"use client";

import type { CrmTimelineItem } from "@/types/crm-pro";
import type { Channel } from "@/types/database";
import {
  Calendar,
  Globe,
  Mail,
  MessageSquare,
  Phone,
  StickyNote,
  TrendingUp,
} from "lucide-react";
import { formatDateLocalized } from "@/lib/i18n";

const iconFor = (type: string, channel: Channel | null) => {
  if (channel === "web") return Globe;
  if (type === "note") return StickyNote;
  if (type === "call") return Phone;
  if (type === "email") return Mail;
  if (type === "meeting") return Calendar;
  if (type === "deal_update") return TrendingUp;
  return MessageSquare;
};

export function ActivityTimeline({
  items,
  locale,
}: {
  items: CrmTimelineItem[];
  locale: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-muted">No activity yet.</p>;
  }

  return (
    <div className="space-y-0">
      {items.map((item, index) => {
        const Icon = iconFor(item.type, item.channel);
        return (
          <div key={item.id} className="relative flex gap-3 pb-6 last:pb-0">
            {index < items.length - 1 && (
              <span className="absolute left-[15px] top-8 h-[calc(100%-12px)] w-px bg-card-border" />
            )}
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-card-border bg-background">
              <Icon className="h-4 w-4 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                {item.channel && (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent">
                    {item.channel}
                  </span>
                )}
              </div>
              {item.body && (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {item.body}
                </p>
              )}
              <p className="mt-1 text-xs text-muted">
                {formatDateLocalized(item.occurred_at, locale as "en" | "zh")}
                {item.actor_name ? ` · ${item.actor_name}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
