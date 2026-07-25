export const MODEL_VERSIONS = {
  max: "gpt-5.6-sol",
  high: "gpt-5.6-terra",
  balanced: "gpt-5.6-luna",
  economy: "gpt-5-nano",
  embedding: "text-embedding-3-small",
} as const;

export type ModelPower = Exclude<keyof typeof MODEL_VERSIONS, "embedding">;

export const MODEL_POWERS = [
  "max",
  "high",
  "balanced",
  "economy",
] as const satisfies readonly ModelPower[];
