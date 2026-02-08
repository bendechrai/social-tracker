import { createOpenRouter } from "@openrouter/ai-sdk-provider";
export function getOpenRouterClient() { const k=process.env.OPENROUTER_API_KEY; if(!k){throw new Error("OPENROUTER_API_KEY not set");} return createOpenRouter({apiKey:k}); }
