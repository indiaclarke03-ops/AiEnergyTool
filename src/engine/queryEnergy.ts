// Module A: energy per query (spec §6.1).
import { get } from "./assumptions";
import type { ModelClass, QueryInput, Values } from "./types";

export type QueryEnergy = {
  reasoningTokens: number;
  outputTokensTotal: number;
  /** Output-token-equivalents: output tokens plus input tokens weighted by the prefill ratio. */
  tokenEquivalents: number;
  gpuWh: number;
  itWh: number;
  facilityWh: number;
};

export const energyPerTokenId = (modelClass: ModelClass) => `e_out.${modelClass}`;

export function reasoningTokensFor(input: QueryInput, v: Values): number {
  if (!input.reasoning) return 0;
  if (input.reasoningTokens !== undefined) return input.reasoningTokens;
  return input.outputTokens * get(v, "reasoning_multiplier");
}

export function queryEnergy(input: QueryInput, v: Values): QueryEnergy {
  const eOut = get(v, energyPerTokenId(input.modelClass));
  const reasoningTokens = reasoningTokensFor(input, v);
  const outputTokensTotal = input.outputTokens + reasoningTokens;
  const tokenEquivalents = outputTokensTotal + input.inputTokens * get(v, "prefill_ratio");

  const gpuWh = tokenEquivalents * eOut;
  const itWh = gpuWh * get(v, "server_overhead");
  const facilityWh = itWh * get(v, "pue.hyperscale");
  return { reasoningTokens, outputTokensTotal, tokenEquivalents, gpuWh, itWh, facilityWh };
}

export function energyAtBoundary(e: QueryEnergy, boundary: QueryInput["boundary"]): number {
  switch (boundary) {
    case "gpu_only":
      return e.gpuWh;
    case "it_load":
      return e.itWh;
    case "facility":
      return e.facilityWh;
  }
}

/** Facility-boundary energy for a single output token of this model class (used by the A↔B link). */
export function facilityWhPerToken(modelClass: ModelClass, v: Values): number {
  return get(v, energyPerTokenId(modelClass)) * get(v, "server_overhead") * get(v, "pue.hyperscale");
}
