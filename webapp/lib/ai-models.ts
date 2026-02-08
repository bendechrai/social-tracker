export interface AiModel { id:string; name:string; vendor:string; }
export const ALLOWED_MODELS:AiModel[]=[{id:"google/gemini-2.0-flash-001",name:"Gemini 2.0 Flash",vendor:"Google"},{id:"anthropic/claude-3.5-haiku",name:"Claude 3.5 Haiku",vendor:"Anthropic"},{id:"openai/gpt-4o-mini",name:"GPT-4o Mini",vendor:"OpenAI"},{id:"meta-llama/llama-3.3-70b-instruct",name:"Llama 3.3 70B",vendor:"Meta"}];
const s=new Set(ALLOWED_MODELS.map(m=>m.id));
export function isAllowedModel(id:string):boolean{return s.has(id);}
