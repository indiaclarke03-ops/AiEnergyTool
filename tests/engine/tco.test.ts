import { describe, expect, it } from "vitest";
import { capitalRecoveryFactor, computeTco, loadDefaultAssumptions, presetOverrides, tcoFromValues, tcoParamsFromValues, valuesAt, withOverrides } from "../../src/engine";

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
    expect(computeTco({ ...p, utilization: 0.3 }).nonEnergyCostPerITKWh).toBeGreaterThan(computeTco(p).nonEnergyCostPerITKWh * 2);
  });
});

describe("presets", () => {
  const set = loadDefaultAssumptions();
  const at = (id: string) => tcoFromValues(valuesAt(withOverrides(set, presetOverrides(set, id))));

  it("Epoch preset equals the defaults", () => {
    expect(at("epoch").annualTCO).toBeCloseTo(tcoFromValues(v).annualTCO);
  });

  it("H100 preset lands near ITK's ~9% electricity share", () => {
    const t = at("h100");
    expect(t.energyShare).toBeGreaterThan(0.06);
    expect(t.energyShare).toBeLessThan(0.13);
  });

  it("colocation tenant has no facility capex but pays rent", () => {
    const t = at("colo");
    expect(t.annualCapex.facility).toBe(0);
    expect(t.otherOpex.colocation).toBeGreaterThan(1e9);
  });
});
