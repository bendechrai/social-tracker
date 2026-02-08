import arcjet, { shield } from "@arcjet/next";

export const ajMode = process.env.NODE_ENV === "production" ? "LIVE" : "DRY_RUN" as const;

const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [shield({ mode: ajMode })],
});

export default aj;
