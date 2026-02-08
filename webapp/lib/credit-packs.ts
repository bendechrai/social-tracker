export interface CreditPack { amountCents:number; creditsCents:number; label:string; }
export const CREDIT_PACKS:CreditPack[]=[{amountCents:500,creditsCents:500,label:"$5"},{amountCents:1000,creditsCents:1000,label:"$10"},{amountCents:2000,creditsCents:2000,label:"$20"}];
const v=new Set(CREDIT_PACKS.map(p=>p.amountCents));
export function isValidPackAmount(a:number):boolean{return v.has(a);}
