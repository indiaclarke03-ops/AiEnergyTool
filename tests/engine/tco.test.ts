import { describe, expect, it } from "vitest";
import { capitalRecoveryFactor, computeTco, loadDefaultAssumptions, tcoFromValues, tcoParamsFromValues, valuesAt } from "../../src/engine";

const v = valuesAt(loadDefaultAssumptions());

describe("TCO sanity (§6.3)", () => {
  it("Epoch defaults → annual TCO ≈ $8.5B and energy share ≈ 7% (±5%)", () => {
    const t = tcoFromValues(v);
    expect(t.annualTCO).toBeGreaterThan(8.5e9 * 0.95);
    expect(t.annualTCO).toBeLessThan(8.5e9 * 1.05);
    expect(t.energyShare).toBeGreaterThan(0.07 * 0.95);
    expect(t.energyShare).toBeLessThan(0.07 * 1.05);
  });

  it("reproduces Epoch's energy bill (~$594M) and annualized capex (~$7.6B)", () => {
    const t = tcoFromValues(v);
    expect(t.annualEnergyCost / 594e6).toBeCloseTo(1, 1);
    expect(t.annualCapexTotal / 7.607e9).toBeCloseTo(1, 1);
  });

  it("3-yr IT lifespan raises TCO to ~$12–13B; 7-yr lowers it to ~$7B (Epoch sensitivities)", () => {
    const p = tcoParamsFromValues(v);
    expect(computeTco({ ...p, lifespanIT: 3 }).annualTCO).toBeGreaterThan(11e9);
    expect(computeTco({ ...p, lifespanIT: 7 }).annualTCO).toBeLessThan(7.6e9);
  });

  it("capital recovery factor: straight-line at r = 0, annuity otherwise", () => {
    expect(capitalRecoveryFactor(0, 5)).toBeCloseTo(0.2);
    expect(capitalRecoveryFactor(0.065, 5)).toBeCloseTo(0.24, 2);
  });

  it("lower utilization raises non-energy cost per kWh", () => {
    const p = tcoParamsFromValues(v);
    expect(computeTco({ ...p, utilization: 0.3 }).nonEnergyCostPerKWh).toBeGreaterThan(computeTco(p).nonEnergyCostPerKWh * 2);
  });
});
