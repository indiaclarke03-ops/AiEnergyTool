import { describe, expect, it } from "vitest";
import { costPerToken, facilityExternalities, impactsAtPoint, loadDefaultAssumptions, priceToCostRatio, tcoFromValues, valuesAt } from "../../src/engine";
import { query } from "./helpers";

const v = valuesAt(loadDefaultAssumptions());
const tco = tcoFromValues(v);

describe("A ↔ B link (§6.4)", () => {
  it("energy-only cost per Mtok is energyShare × full cost per Mtok", () => {
    const c = costPerToken(tco, "frontier", v);
    expect(c.costPerMTokEnergy / c.costPerMTokFull).toBeCloseTo(tco.energyShare, 6);
  });

  it("smaller models are cheaper per token", () => {
    expect(costPerToken(tco, "small", v).costPerMTokFull).toBeLessThan(costPerToken(tco, "frontier", v).costPerMTokFull);
  });

  it("full per-query cost exceeds energy-only cost", () => {
    const p = impactsAtPoint(query(), v, { includeEmbodied: false });
    expect(p.fullCostUsd).toBeGreaterThan(p.energyCostUsd * 5);
  });

  it("per-query full cost equals token-equivalents × cost/token when PUE and price match", () => {
    const vv = { ...v, "tco.pue": v["pue.hyperscale"]!, "tco.electricity_price": v["grid.us-east.price"]! };
    const t = tcoFromValues(vv);
    const c = costPerToken(t, "frontier", vv);
    const p = impactsAtPoint(query(), vv, { includeEmbodied: false });
    expect(p.fullCostUsd).toBeCloseTo((p.energy.tokenEquivalents * c.costPerMTokFull) / 1e6, 9);
  });

  it("price/cost ratio", () => {
    const c = costPerToken(tco, "frontier", v);
    expect(priceToCostRatio(c.costPerMTokFull * 2, c)).toBeCloseTo(2);
  });

  it("headline: energy is a small share of cost but a large share of externalities", () => {
    const e = facilityExternalities(tco, "us-east", v);
    expect(tco.energyShare).toBeLessThan(0.15);
    expect(e.energyShareOfExternality).toBeGreaterThan(0.5);
  });
});
