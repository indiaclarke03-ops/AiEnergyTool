// One-at-a-time sensitivity sweep for tornado charts (spec §6.5).
import { valuesAt } from "./assumptions";
import type { AssumptionSet, Values } from "./types";

export type TornadoBar = {
  id: string;
  label: string;
  unit: string;
  verified: boolean;
  outputAtLow: number;
  outputAtHigh: number;
  swing: number;
};

export type TornadoResult = { baseline: number; bars: TornadoBar[] };

/**
 * Sweep each assumption from low to high with all others at central, and rank by swing.
 * Pass `ids` to restrict the sweep; otherwise every assumption with a non-zero range is tried and
 * assumptions that don't affect the output are dropped.
 */
export function tornado(set: AssumptionSet, fn: (v: Values) => number, ids?: string[]): TornadoResult {
  const base = valuesAt(set, "central");
  const baseline = fn(base);
  const bars: TornadoBar[] = [];
  for (const id of ids ?? Object.keys(set.assumptions)) {
    const a = set.assumptions[id];
    if (!a || a.value.low === a.value.high) continue;
    const outputAtLow = fn({ ...base, [id]: a.value.low });
    const outputAtHigh = fn({ ...base, [id]: a.value.high });
    const swing = Math.abs(outputAtHigh - outputAtLow);
    if (swing <= Math.abs(baseline) * 1e-9) continue;
    bars.push({ id, label: a.label, unit: a.unit, verified: a.verified, outputAtLow, outputAtHigh, swing });
  }
  bars.sort((x, y) => y.swing - x.swing);
  return { baseline, bars };
}
