import { describe, expect, it } from "vitest";
import { loadDefaultAssumptions, parseAssumptionFiles, recenter, valuesAt, withOverrides } from "../../src/engine";
import models from "../../data/assumptions/models.json";
import overheads from "../../data/assumptions/overheads.json";
import grid from "../../data/assumptions/grid.json";
import tco from "../../data/assumptions/datacenter_tco.json";
import levers from "../../data/assumptions/levers.json";

const raw = { models, overheads, grid, datacenter_tco: tco, levers };

describe("assumption files", () => {
  it("all pass zod validation", () => {
    const set = loadDefaultAssumptions();
    expect(Object.keys(set.assumptions).length).toBeGreaterThan(40);
    expect(set.regions).toHaveLength(8);
    expect(set.levers).toHaveLength(8);
  });

  it("every assumption has a source and a verified flag", () => {
    for (const a of Object.values(loadDefaultAssumptions().assumptions)) {
      expect(a.sources.length, a.id).toBeGreaterThan(0);
      expect(typeof a.verified).toBe("boolean");
    }
  });

  it("rejects a range with low > central", () => {
    const bad = structuredClone(raw);
    bad.models.assumptions[0]!.value.low = 1;
    expect(() => parseAssumptionFiles(bad)).toThrow();
  });

  it("rejects a lever that references an unknown assumption", () => {
    const bad = structuredClone(raw);
    bad.levers.levers[2]!.effectAssumption = "does.not.exist";
    expect(() => parseAssumptionFiles(bad)).toThrow(/unknown assumption/);
  });

  it("applies overrides without mutating defaults", () => {
    const set = loadDefaultAssumptions();
    const o = withOverrides(set, { "pue.hyperscale": { low: 1.5, central: 1.6, high: 1.7 } });
    expect(valuesAt(o)["pue.hyperscale"]).toBe(1.6);
    expect(valuesAt(set)["pue.hyperscale"]).toBe(1.12);
  });

  it("recenter keeps relative spread", () => {
    expect(recenter({ low: 1, central: 2, high: 4 }, 4)).toEqual({ low: 2, central: 4, high: 8 });
  });
});
