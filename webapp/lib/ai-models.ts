export interface AiModel {
  id: string;
  name: string;
  vendor: string;
}

export const ALLOWED_MODELS: AiModel[] = [
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", vendor: "Google" },
  { id: "google/gemini-2.5-pro-preview", name: "Gemini 2.5 Pro", vendor: "Google" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", vendor: "Anthropic" },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", vendor: "Anthropic" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", vendor: "OpenAI" },
  { id: "openai/gpt-4o", name: "GPT-4o", vendor: "OpenAI" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", vendor: "Meta" },
  { id: "deepseek/deepseek-chat-v3-0324", name: "DeepSeek V3", vendor: "DeepSeek" },
  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B", vendor: "Qwen" },
];

const allowedModelIds = new Set(ALLOWED_MODELS.map((m) => m.id));

export function isAllowedModel(modelId: string): boolean {
  return allowedModelIds.has(modelId);
}
