export interface AiModel {
  id: string;
  name: string;
  vendor: string;
}

export const ALLOWED_MODELS: AiModel[] = [
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", vendor: "OpenAI" },
  { id: "openai/gpt-4o", name: "GPT-4o", vendor: "OpenAI" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", vendor: "Anthropic" },
  { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku", vendor: "Anthropic" },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", vendor: "Google" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", vendor: "Meta" },
  { id: "meta-llama/llama-3.1-8b-instruct", name: "Llama 3.1 8B", vendor: "Meta" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3", vendor: "DeepSeek" },
  { id: "mistralai/mistral-large", name: "Mistral Large", vendor: "Mistral" },
];

const allowedModelIds = new Set(ALLOWED_MODELS.map((m) => m.id));

export function isAllowedModel(id: string): boolean {
  return allowedModelIds.has(id);
}
