// Monte Carlo propagation over triangular distributions (spec §6.5).
import type { AssumptionSet, Range, Values } from "./types";

/** Small deterministic PRNG so runs are reproducible given a seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inverse-CDF sample from a triangular distribution. */
export function sampleTriangular(r: Range, u: number): number {
  const { low: a, central: c, high: b } = r;
  if (b === a) return c;
  const fc = (c - a) / (b - a);
  return u < fc ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
}

export function sampleValues(set: AssumptionSet, rand: () => number): Values {
  const v: Values = {};
  for (const [id, a] of Object.entries(set.assumptions)) v[id] = sampleTriangular(a.value, rand());
  return v;
}

export type Histogram = { binEdges: number[]; counts: number[] };

export type Distribution = {
  p5: number;
  p50: number;
  p95: number;
  mean: number;
  histogram: Histogram;
};

export type MonteCarloOptions = { n?: number; seed?: number; bins?: number; keepSamples?: boolean };

export type MonteCarloResult<K extends string> = {
  n: number;
  metrics: Record<K, Distribution>;
  samples?: Record<K, number[]>;
};

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export function histogram(sorted: number[], bins: number): Histogram {
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const width = max > min ? (max - min) / bins : 1;
  const binEdges = Array.from({ length: bins + 1 }, (_, i) => min + i * width);
  const counts = new Array<number>(bins).fill(0);
  for (const x of sorted) counts[Math.min(bins - 1, Math.floor((x - min) / width))]!++;
  return { binEdges, counts };
}

export function summarize(samples: number[], bins = 40): Distribution {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p5: quantile(sorted, 0.05),
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    mean: sorted.reduce((s, x) => s + x, 0) / sorted.length,
    histogram: histogram(sorted, bins),
  };
}

/** Run `fn` on N sampled points and summarize each returned metric. */
export function runMonteCarlo<K extends string>(
  set: AssumptionSet,
  fn: (v: Values) => Record<K, number>,
  opts: MonteCarloOptions = {},
): MonteCarloResult<K> {
  const n = opts.n ?? 5000;
  const rand = mulberry32(opts.seed ?? 42);
  const collected = {} as Record<K, number[]>;
  for (let i = 0; i < n; i++) {
    const out = fn(sampleValues(set, rand));
    for (const k of Object.keys(out) as K[]) (collected[k] ??= []).push(out[k]);
  }
  const metrics = {} as Record<K, Distribution>;
  for (const k of Object.keys(collected) as K[]) metrics[k] = summarize(collected[k], opts.bins);
  return { n, metrics, samples: opts.keepSamples ? collected : undefined };
}
