import "server-only";

export {
  getLlmBaseURL as getOpenAIBaseURL,
  getLlmProvider,
  getChatModel,
  isLlmConfigured,
  getLlmDisplayName,
  getLlmApiKey,
} from "@/lib/ai/llm-config";
