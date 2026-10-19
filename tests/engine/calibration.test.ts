// Calibration tests from spec §6.1. If these fail, adjust the JSON ranges, not the formulas.
import { describe, expect, it } from "vitest";
import { estimateQuery, impactsAtPoint, loadDefaultAssumptions, valuesAt } from "../../src/engine";
import { query } from "./helpers";

const set = loadDefaultAssumptions();
const central = valuesAt(set);
const opts = { includeEmbodied: false };

describe("calibration (§6.1)", () => {
  it("frontier, non-reasoning, ~500 output tokens, facility boundary → 0.2–0.5 Wh", () => {
    const wh = impactsAtPoint(query(), central, opts).energyWh;
    expect(wh).toBeGreaterThanOrEqual(0.2);
    expect(wh).toBeLessThanOrEqual(0.5);
  });

  it("frontier reasoning query with ~5,000 output tokens → 2–7 Wh", () => {
    // 5,000 total output tokens: 500 visible + 4,500 reasoning.
    const wh = impactsAtPoint(query({ reasoning: true, reasoningTokens: 4500 }), central, opts).energyWh;
    expect(wh).toBeGreaterThanOrEqual(2);
    expect(wh).toBeLessThanOrEqual(7);
  });

  it("frontier reasoning with estimated reasoning tokens also lands in 2–7 Wh", () => {
    const wh = impactsAtPoint(query({ reasoning: true }), central, opts).energyWh;
    expect(wh).toBeGreaterThanOrEqual(2);
    expect(wh).toBeLessThanOrEqual(7);
  });

  it("small model, short query → ≤ 0.1 Wh", () => {
    const wh = impactsAtPoint(query({ modelClass: "small", inputTokens: 50, outputTokens: 150 }), central, opts).energyWh;
    expect(wh).toBeLessThanOrEqual(0.1);
  });

  it("Monte Carlo range brackets the central value and is ordered", () => {
    const e = estimateQuery(query(), set, { ...opts, mc: { n: 2000 } });
    for (const r of [e.energyWh, e.carbonG, e.waterMl, e.energyCostUsd, e.fullCostUsd]) {
      expect(r.low).toBeLessThanOrEqual(r.central);
      expect(r.central).toBeLessThanOrEqual(r.high);
      expect(r.low).toBeGreaterThan(0);
    }
    // Median frontier query should still sit in the anchor band.
    expect(e.energyWh.central).toBeGreaterThan(0.2);
  });

  it("boundaries are nested: gpu_only < it_load < facility", () => {
    const g = impactsAtPoint(query({ boundary: "gpu_only" }), central, opts).energyWh;
    const i = impactsAtPoint(query({ boundary: "it_load" }), central, opts).energyWh;
    const f = impactsAtPoint(query({ boundary: "facility" }), central, opts).energyWh;
    expect(g).toBeLessThan(i);
    expect(i).toBeLessThan(f);
  });
});
