import "server-only";

import { deepSeekChat } from "@/lib/ai/deepseek-client";
import { getOpenAI, getChatModel, openAiErrorMessage } from "@/lib/ai/client";
import { getLlmProvider } from "@/lib/ai/llm-config";
import {
  buildAngleSystemPrompt,
  buildAngleUserMessage,
  buildWriterSystemPrompt,
  buildWriterUserMessage,
  sanitizeSocialDraft,
  type SocialCopyPlatform,
  type SocialCopyStyle,
} from "@/lib/ai/social-copy-prompt";
import { getAgentTrainingBrief, getCombinedAnalysis } from "@/lib/ai/agent-knowledge";
import { readAppSettings } from "@/lib/finance/settings";

async function buildCreatorCloneBrief() {
  const settings = await readAppSettings();
  const marketing = settings.socialMarketingPrompt?.trim() ?? "";
  if (marketing.length > 30) {
    return { brief: marketing, hasTraining: true, source: "marketing" as const };
  }

  const [creatorBrief, combinedAnalysis] = await Promise.all([
    getAgentTrainingBrief(),
    getCombinedAnalysis(),
  ]);
  const personalityParts = [creatorBrief.trim()];
  if (combinedAnalysis?.summary) {
    personalityParts.push(
      `Analyzed creator profile:\nSummary: ${combinedAnalysis.summary}\nTopics: ${combinedAnalysis.topics.join("、")}\nMust NOT say: ${combinedAnalysis.mustNotSay.join("；")}`,
    );
  }
  const brief = personalityParts.filter(Boolean).join("\n\n");
  return {
    brief,
    hasTraining: brief.length > 80,
    source: "agent" as const,
  };
}

function fallbackAngle(topic: string) {
  return {
    hook_line: `关于「${topic}」，大多数人第一步就想错了。`,
    contrarian_angle: "不是不够努力，是顺序错了",
    points: [
      "先搞清楚自己的目标和能承受的波动",
      "查信息认准官方渠道，别只看截图",
      "任何「稳赚」话术都先打个问号",
    ],
    comment_bait: "你踩过类似的坑吗？",
    title_hooks: [`${topic}？90%的人第一步就错了`, `${topic.slice(0, 12)}，别急着动手`],
  };
}

async function chatJson(
  system: string,
  user: string,
  temperature: number,
  maxTokens: number,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  if (getLlmProvider() === "deepseek") {
    const result = await deepSeekChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      json: true,
      temperature,
      maxTokens,
    });
    if (!result.ok) return { ok: false, error: result.error };
    try {
      return { ok: true, data: JSON.parse(result.content) as Record<string, unknown> };
    } catch {
      return { ok: false, error: "AI returned invalid JSON" };
    }
  }

  const openai = getOpenAI();
  if (!openai) return { ok: false, error: "AI not configured" };

  try {
    const response = await openai.chat.completions.create({
      model: getChatModel(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature,
      max_tokens: maxTokens,
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    return { ok: true, data: JSON.parse(raw) as Record<string, unknown> };
  } catch (error) {
    return { ok: false, error: openAiErrorMessage(error) };
  }
}

export async function generateSocialCopy(params: {
  topic: string;
  locale: "en" | "zh" | "both";
  platform: SocialCopyPlatform;
  style?: SocialCopyStyle;
}): Promise<
  | { ok: true; draft: ReturnType<typeof sanitizeSocialDraft> }
  | { ok: false; error: string }
> {
  const style = params.style ?? "viral";

  const clone = await buildCreatorCloneBrief();

  const angleResult = await chatJson(
    buildAngleSystemPrompt(params.platform, style),
    buildAngleUserMessage(params.topic),
    0.72,
    500,
  );

  const angle = angleResult.ok ? angleResult.data : fallbackAngle(params.topic);

  const writerResult = await chatJson(
    buildWriterSystemPrompt(params.platform, style, clone.brief),
    buildWriterUserMessage({
      topic: params.topic,
      locale: params.locale,
      angle,
      hasCreatorTraining: clone.hasTraining,
    }),
    0.7,
    2800,
  );

  if (!writerResult.ok) {
    return { ok: false, error: writerResult.error };
  }

  const draft = writerResult.data;
  const titles = angle.title_hooks;
  if (
    Array.isArray(titles) &&
    typeof titles[0] === "string" &&
    typeof draft.title === "string" &&
    draft.title.length < 8
  ) {
    draft.title = titles[0];
  }

  return { ok: true, draft: sanitizeSocialDraft(draft) };
}
