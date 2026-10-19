// Efficiency levers (spec §6.6). Applied to a single point so lever effect ranges flow through Monte Carlo.
import { get } from "./assumptions";
import type { Actor, Lever, ModelClass, QueryInput, Values } from "./types";

const SMALLER: Record<ModelClass, ModelClass> = { frontier: "medium", medium: "small", small: "small" };

export function applyLevers(
  input: QueryInput,
  v: Values,
  levers: Lever[],
): { input: QueryInput; values: Values } {
  let next = { ...input };
  const values: Values = { ...v };

  for (const lever of levers) {
    switch (lever.kind) {
      case "reasoning_off":
        next = { ...next, reasoning: false, reasoningTokens: undefined };
        break;
      case "model_downsize":
        next = { ...next, modelClass: SMALLER[next.modelClass] };
        break;
      case "region_switch":
        if (lever.targetRegion) next = { ...next, region: lever.targetRegion };
        break;
      case "multiply": {
        const k = get(values, lever.effectAssumption!);
        for (const t of lever.targets ?? []) values[t] = get(values, t) * k;
        break;
      }
      case "set": {
        const x = get(values, lever.effectAssumption!);
        // A "set" lever never makes things worse than the current value (e.g. PUE already below 1.08).
        const better = lever.improves === "higher" ? Math.max : Math.min;
        for (const t of lever.targets ?? []) values[t] = better(get(values, t), x);
        break;
      }
    }
  }
  return { input: next, values };
}

export function leversByActor(levers: Lever[]): Record<Actor, Lever[]> {
  const out: Record<Actor, Lever[]> = { user: [], provider: [], policy: [] };
  for (const l of levers) for (const a of l.actors) out[a].push(l);
  return out;
}

/** Percentage change from before to after (negative = reduction). */
export const pctChange = (before: number, after: number) => (before === 0 ? 0 : (after - before) / before);
