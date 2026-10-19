import type { QueryInput } from "../../src/engine";

export const query = (over: Partial<QueryInput> = {}): QueryInput => ({
  modelClass: "frontier",
  inputTokens: 100,
  outputTokens: 500,
  reasoning: false,
  region: "us-east",
  boundary: "facility",
  modality: "text",
  ...over,
});
