import { describe, expect, it } from "vitest";
import { applyLevers, impactsAtPoint, leversByActor, loadDefaultAssumptions, valuesAt } from "../../src/engine";
import { query } from "./helpers";

const set = loadDefaultAssumptions();
const v = valuesAt(set);
const lever = (id: string) => set.levers.find((l) => l.id === id)!;
const opts = { includeEmbodied: false };
const run = (ids: string[], q = query()) => {
  const a = applyLevers(q, v, ids.map(lever));
  return impactsAtPoint(a.input, a.values, opts);
};

describe("levers (§6.6)", () => {
  it("reasoning off removes reasoning tokens", () => {
    expect(run(["reasoning_off"], query({ reasoning: true })).energy.reasoningTokens).toBe(0);
  });

  it("smaller model steps frontier → medium", () => {
    expect(applyLevers(query(), v, [lever("smaller_model")]).input.modelClass).toBe("medium");
  });

  it("FP8 cuts energy by ~26%", () => {
    const ratio = run(["fp8"]).energyWh / run([]).energyWh;
    expect(ratio).toBeCloseTo(0.735, 3);
  });

  it("carbon-aware siting cuts carbon but not energy", () => {
    const base = run([]);
    const after = run(["carbon_aware"]);
    expect(after.energyWh).toBeCloseTo(base.energyWh);
    expect(after.carbonG).toBeLessThan(base.carbonG * 0.2);
  });

  it("longer lifespan cuts full cost but not carbon (cost lever vs carbon lever)", () => {
    const base = run([]);
    const after = run(["longer_lifespan"]);
    expect(after.carbonG).toBeCloseTo(base.carbonG);
    expect(after.fullCostUsd).toBeLessThan(base.fullCostUsd);
  });

  it("liquid cooling never raises full cost", () => {
    expect(run(["liquid_cooling"]).fullCostUsd).toBeLessThanOrEqual(run([]).fullCostUsd);
  });

  it("levers stack multiplicatively", () => {
    const ratio = run(["fp8", "batching"]).energyWh / run([]).energyWh;
    expect(ratio).toBeCloseTo(0.735 * 0.35, 3);
  });

  it("does not mutate the input values", () => {
    applyLevers(query(), v, [lever("fp8")]);
    expect(v["e_out.frontier"]).toBe(0.0005);
  });

  it("groups by actor", () => {
    const g = leversByActor(set.levers);
    expect(g.user.map((l) => l.id)).toContain("reasoning_off");
    expect(g.policy.map((l) => l.id)).toContain("carbon_aware");
  });
});
