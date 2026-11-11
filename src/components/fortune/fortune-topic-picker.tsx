"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { getFortuneDateShort } from "@/lib/fortune/date";
import type { FortuneTopic } from "@/types/fortune";

const THEME_TOPICS: FortuneTopic[] = ["daily", "career", "wealth", "love"];
const EASTERN_METHOD_TOPICS: FortuneTopic[] = ["ziwei", "meihua", "yijing", "chenggu"];
const EASTERN_QUICK_TOPICS: FortuneTopic[] = ["mianxiang", "ziwei", "meihua", "yijing", "chenggu"];
const WESTERN_METHOD_TOPICS: FortuneTopic[] = ["astro", "tarot", "numerology"];
const MORE_SYNTHESIS: FortuneTopic[] = ["general"];

type TopicGroup = {
  key: string;
  label: string;
  topics: FortuneTopic[];
  activeClass: string;
  hoverClass: string;
};

export function FortuneTopicPicker({
  topic,
  onTopicChange,
  locale,
  t,
}: {
  topic: FortuneTopic;
  onTopicChange: (topic: FortuneTopic) => void;
  locale: "en" | "zh";
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [showMore, setShowMore] = useState(false);

  const groups: TopicGroup[] = [
    {
      key: "theme",
      label: t("fortune.themeTopics"),
      topics: THEME_TOPICS,
      activeClass: "bg-accent text-accent-foreground shadow-sm",
      hoverClass: "hover:border-accent/50 hover:text-foreground",
    },
    {
      key: "eastern",
      label: t("fortune.easternMethodTopics"),
      topics: EASTERN_METHOD_TOPICS,
      activeClass: "bg-amber-600 text-white shadow-sm",
      hoverClass: "hover:border-amber-500/50 hover:text-foreground",
    },
    {
      key: "western",
      label: t("fortune.westernMethodTopics"),
      topics: WESTERN_METHOD_TOPICS,
      activeClass: "bg-violet-600 text-white shadow-sm",
      hoverClass: "hover:border-violet-500/50 hover:text-foreground",
    },
    {
      key: "synthesis",
      label: t("fortune.synthesisTopics"),
      topics: MORE_SYNTHESIS,
      activeClass: "bg-violet-600 text-white shadow-sm",
      hoverClass: "hover:border-violet-500/50 hover:text-foreground",
    },
  ];

  function chipClass(active: boolean, activeClass: string, hoverClass: string, large?: boolean) {
    return [
      "rounded-xl font-medium transition-all",
      large ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs",
      active
        ? activeClass
        : `border border-card-border bg-background/60 text-muted ${hoverClass}`,
    ].join(" ");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onTopicChange("combined")}
          className={`${chipClass(topic === "combined", "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md ring-2 ring-violet-400/30", "", true)} text-left`}
        >
          <span className="block font-semibold">{t("fortune.topics.combined")}</span>
          <span className="mt-0.5 block text-xs opacity-90">{t("fortune.combinedHintShort")}</span>
        </button>
        <button
          type="button"
          onClick={() => onTopicChange("daily")}
          className={`${chipClass(topic === "daily", "bg-accent text-accent-foreground shadow-md", "", true)} text-left`}
        >
          <span className="block font-semibold">
            {t("fortune.topics.daily")} · {getFortuneDateShort(locale)}
          </span>
          <span className="mt-0.5 block text-xs opacity-90">{t("fortune.dailyHintShort")}</span>
        </button>
        <button
          type="button"
          onClick={() => onTopicChange("mianxiang")}
          className={`${chipClass(topic === "mianxiang", "bg-gradient-to-br from-amber-600 to-orange-600 text-white shadow-md ring-2 ring-amber-400/30", "", true)} text-left`}
        >
          <span className="block font-semibold">{t("fortune.topics.mianxiang")}</span>
          <span className="mt-0.5 block text-xs opacity-90">{t("fortune.mianxiangHintShort")}</span>
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted">{t("fortune.easternMethodTopics")}</p>
        <div className="flex flex-wrap gap-2">
          {EASTERN_QUICK_TOPICS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onTopicChange(item)}
              className={chipClass(
                topic === item,
                item === "mianxiang"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-amber-600 text-white shadow-sm",
                "hover:border-amber-500/50 hover:text-foreground",
              )}
            >
              {t(`fortune.topics.${item}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-card-border bg-background/50 px-3 py-2 text-sm text-muted transition-colors hover:border-accent/40 hover:text-foreground"
          onClick={() => setShowMore((v) => !v)}
        >
          <span>{t("fortune.topicMore")}</span>
          {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showMore ? (
          <div className="mt-3 space-y-4 rounded-lg border border-card-border/80 bg-background/40 p-3">
            {groups.map((group) => (
              <div key={group.key}>
                <p className="mb-2 text-xs font-medium text-muted">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.topics.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => onTopicChange(item)}
                      className={chipClass(topic === item, group.activeClass, group.hoverClass)}
                    >
                      {t(`fortune.topics.${item}`)}
                      {item === "daily" ? ` · ${getFortuneDateShort(locale)}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
