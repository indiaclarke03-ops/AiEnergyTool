import { describe, expect, it } from "vitest";
import { impactsAtPoint, loadDefaultAssumptions, mulberry32, runMonteCarlo, sampleTriangular, tcoFromValues, tornado } from "../../src/engine";
import { query } from "./helpers";

const set = loadDefaultAssumptions();

describe("Monte Carlo (§6.5)", () => {
  it("triangular sampling stays in range and has the right mean", () => {
    const rand = mulberry32(1);
    const r = { low: 1, central: 2, high: 6 };
    let sum = 0;
    for (let i = 0; i < 20000; i++) {
      const x = sampleTriangular(r, rand());
      expect(x).toBeGreaterThanOrEqual(1);
      expect(x).toBeLessThanOrEqual(6);
      sum += x;
    }
    expect(sum / 20000).toBeCloseTo(3, 1);
  });

  it("is deterministic for a seed and returns p5 ≤ p50 ≤ p95 with a full histogram", () => {
    const fn = (v: Record<string, number>) => ({ wh: impactsAtPoint(query(), v, { includeEmbodied: false }).energyWh });
    const a = runMonteCarlo(set, fn, { n: 1000, seed: 7 });
    const b = runMonteCarlo(set, fn, { n: 1000, seed: 7 });
    expect(a.metrics.wh).toEqual(b.metrics.wh);
    const d = a.metrics.wh;
    expect(d.p5).toBeLessThanOrEqual(d.p50);
    expect(d.p50).toBeLessThanOrEqual(d.p95);
    expect(d.histogram.counts.reduce((s, x) => s + x, 0)).toBe(1000);
  });
});

describe("sensitivity (§6.5)", () => {
  it("ranks the frontier energy-per-token assumption first for query energy", () => {
    const t = tornado(set, (v) => impactsAtPoint(query(), v, { includeEmbodied: false }).energyWh);
    expect(t.bars[0]!.id).toBe("e_out.frontier");
    expect(t.bars.every((b, i) => i === 0 || b.swing <= t.bars[i - 1]!.swing)).toBe(true);
    // Irrelevant assumptions (other regions) are dropped.
    expect(t.bars.some((b) => b.id.startsWith("grid.sweden"))).toBe(false);
  });

  it("ranks IT lifespan or server capex near the top for annual TCO", () => {
    const t = tornado(set, (v) => tcoFromValues(v).annualTCO);
    expect(["tco.lifespan.it", "tco.capex.servers"]).toContain(t.bars[0]!.id);
  });
});
