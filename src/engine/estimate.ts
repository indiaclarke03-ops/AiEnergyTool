// High-level entry points: point estimates + Monte Carlo → ranges (low = p5, high = p95).
import { tracked, valuesAt } from "./assumptions";
import { impactsAtPoint, type ImpactOptions } from "./impacts";
import { applyLevers } from "./levers";
import { runMonteCarlo, type MonteCarloOptions } from "./montecarlo";
import type { AssumptionSet, ImpactEstimate, Lever, QueryInput, Range, Values } from "./types";

export type EstimateOptions = ImpactOptions & { levers?: Lever[]; mc?: MonteCarloOptions };

const METRICS = ["energyWh", "carbonG", "waterMl", "energyCostUsd", "fullCostUsd"] as const;
type MetricKey = (typeof METRICS)[number];

export function queryMetricsAtPoint(input: QueryInput, v: Values, opts: EstimateOptions): Record<MetricKey, number> {
  const applied = applyLevers(input, v, opts.levers ?? []);
  const p = impactsAtPoint(applied.input, applied.values, opts);
  return { energyWh: p.energyWh, carbonG: p.carbonG, waterMl: p.waterMl, energyCostUsd: p.energyCostUsd, fullCostUsd: p.fullCostUsd };
}

/** Build a Range: central from central values; low/high from Monte Carlo p5/p95 (widened to include central). */
export const toRange = (central: number, p5: number, p95: number): Range => ({
  low: Math.min(p5, central),
  central,
  high: Math.max(p95, central),
});

export function estimateQuery(input: QueryInput, set: AssumptionSet, opts: EstimateOptions): ImpactEstimate {
  const t = tracked(valuesAt(set, "central"));
  const central = queryMetricsAtPoint(input, t.values, opts);
  const mc = runMonteCarlo(set, (v) => queryMetricsAtPoint(input, v, opts), { n: 5000, ...opts.mc });
  const r = (k: MetricKey) => toRange(central[k], mc.metrics[k].p5, mc.metrics[k].p95);
  return {
    energyWh: r("energyWh"),
    carbonG: r("carbonG"),
    waterMl: r("waterMl"),
    energyCostUsd: r("energyCostUsd"),
    fullCostUsd: r("fullCostUsd"),
    boundary: input.boundary,
    impactBoundary: opts.includeEmbodied ? "lifecycle" : "facility",
    assumptionsUsed: [...t.used].sort(),
  };
}

/**
 * Fractional change in each metric from applying each lever on its own (central values).
 * Negative = reduction. Used for "What would change this?" and the per-line provider lever.
 */
export function leverEffects(
  input: QueryInput,
  set: AssumptionSet,
  opts: ImpactOptions,
  levers: Lever[],
): Record<string, Record<MetricKey, number>> {
  const v = valuesAt(set, "central");
  const base = queryMetricsAtPoint(input, v, opts);
  const out: Record<string, Record<MetricKey, number>> = {};
  for (const l of levers) {
    const after = queryMetricsAtPoint(input, v, { ...opts, levers: [l] });
    out[l.id] = Object.fromEntries(METRICS.map((k) => [k, base[k] === 0 ? 0 : (after[k] - base[k]) / base[k]])) as Record<MetricKey, number>;
  }
  return out;
}

export { METRICS as QUERY_METRICS };
export type { MetricKey as QueryMetric };
