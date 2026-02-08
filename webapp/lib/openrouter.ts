import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }
  return createOpenRouter({ apiKey });
}
