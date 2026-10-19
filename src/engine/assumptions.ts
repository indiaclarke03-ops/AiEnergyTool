// Load + zod-validate the assumption JSON files, and turn them into numeric points.
import { z } from "zod";
import type { Assumption, AssumptionSet, Range, Values } from "./types";

import modelsJson from "../../data/assumptions/models.json";
import overheadsJson from "../../data/assumptions/overheads.json";
import gridJson from "../../data/assumptions/grid.json";
import tcoJson from "../../data/assumptions/datacenter_tco.json";
import leversJson from "../../data/assumptions/levers.json";

const rangeSchema = z
  .object({ low: z.number().finite(), central: z.number().finite(), high: z.number().finite() })
  .refine((r) => r.low <= r.central && r.central <= r.high, { message: "Range must satisfy low ≤ central ≤ high" });

const boundarySchema = z.enum(["gpu_only", "it_load", "facility", "lifecycle"]);
const sourceSchema = z.object({ title: z.string().min(1), url: z.string().url(), note: z.string().optional() });

export const assumptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  unit: z.string().min(1),
  value: rangeSchema,
  boundary: boundarySchema.optional(),
  sources: z.array(sourceSchema).min(1, "Every assumption needs at least one source"),
  verified: z.boolean(),
  notes: z.string().optional(),
});

const leverSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  actors: z.array(z.enum(["user", "provider", "policy"])).min(1),
  metrics: z.array(z.enum(["energy", "carbon", "water", "cost"])).min(1),
  kind: z.enum(["reasoning_off", "model_downsize", "multiply", "set", "region_switch"]),
  targets: z.array(z.string()).optional(),
  effectAssumption: z.string().optional(),
  targetRegion: z.string().optional(),
  improves: z.enum(["lower", "higher"]).optional(),
  sources: z.array(sourceSchema).min(1),
  verified: z.boolean(),
});

const baseFile = z.object({ version: z.string(), assumptions: z.array(assumptionSchema) });

export const fileSchemas = {
  models: baseFile.extend({
    modelClasses: z.array(
      z.object({ key: z.enum(["small", "medium", "frontier"]), label: z.string(), energyAssumption: z.string() }),
    ),
  }),
  overheads: baseFile,
  grid: baseFile.extend({ regions: z.array(z.object({ key: z.string(), label: z.string() })).min(1) }),
  datacenter_tco: baseFile.extend({
    presets: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        description: z.string(),
        values: z.record(z.string(), z.number().finite()),
        sources: z.array(sourceSchema).min(1),
        verified: z.boolean(),
      }),
    ),
  }),
  levers: baseFile.extend({ levers: z.array(leverSchema) }),
};

export type RawFiles = { [K in keyof typeof fileSchemas]: unknown };

/** Validate raw file contents and assemble an AssumptionSet. Throws a readable error on any problem. */
export function parseAssumptionFiles(raw: RawFiles): AssumptionSet {
  const models = fileSchemas.models.parse(raw.models);
  const overheads = fileSchemas.overheads.parse(raw.overheads);
  const grid = fileSchemas.grid.parse(raw.grid);
  const tco = fileSchemas.datacenter_tco.parse(raw.datacenter_tco);
  const levers = fileSchemas.levers.parse(raw.levers);

  const assumptions: Record<string, Assumption> = {};
  for (const file of [models, overheads, grid, tco, levers]) {
    for (const a of file.assumptions) {
      if (assumptions[a.id]) throw new Error(`Duplicate assumption id: ${a.id}`);
      assumptions[a.id] = a;
    }
  }

  const missing = (id: string, where: string) => {
    if (!assumptions[id]) throw new Error(`${where} references unknown assumption "${id}"`);
  };
  for (const m of models.modelClasses) missing(m.energyAssumption, `Model class ${m.key}`);
  for (const r of grid.regions) {
    for (const k of ["intensity", "price", "wue_offsite"]) missing(`grid.${r.key}.${k}`, `Region ${r.key}`);
  }
  for (const l of levers.levers) {
    l.targets?.forEach((t) => missing(t, `Lever ${l.id}`));
    if (l.effectAssumption) missing(l.effectAssumption, `Lever ${l.id}`);
    if (l.targetRegion && !grid.regions.some((r) => r.key === l.targetRegion)) {
      throw new Error(`Lever ${l.id} targets unknown region ${l.targetRegion}`);
    }
  }
  for (const p of tco.presets) for (const id of Object.keys(p.values)) missing(id, `Preset ${p.id}`);

  return {
    versions: {
      models: models.version,
      overheads: overheads.version,
      grid: grid.version,
      datacenter_tco: tco.version,
      levers: levers.version,
    },
    assumptions,
    modelClasses: models.modelClasses,
    regions: grid.regions,
    levers: levers.levers,
    tcoPresets: tco.presets,
  };
}

export function loadDefaultAssumptions(): AssumptionSet {
  return parseAssumptionFiles({
    models: modelsJson,
    overheads: overheadsJson,
    grid: gridJson,
    datacenter_tco: tcoJson,
    levers: leversJson,
  });
}

/** Apply per-session overrides (e.g. edits in the Assumptions Browser) without mutating the defaults. */
export function withOverrides(set: AssumptionSet, overrides: Record<string, Range>): AssumptionSet {
  const assumptions = { ...set.assumptions };
  for (const [id, value] of Object.entries(overrides)) {
    const a = assumptions[id];
    if (!a) continue;
    rangeSchema.parse(value);
    assumptions[id] = { ...a, value };
  }
  return { ...set, assumptions };
}

/** Apply a preset's central values as overrides, keeping each assumption's relative uncertainty. */
export function presetOverrides(set: AssumptionSet, presetId: string): Record<string, Range> {
  const preset = set.tcoPresets.find((p) => p.id === presetId);
  if (!preset) throw new Error(`Unknown preset ${presetId}`);
  const out: Record<string, Range> = {};
  for (const [id, x] of Object.entries(preset.values)) {
    const base = set.assumptions[id]!.value;
    // A zero-centred default (e.g. colocation rent) has no spread to scale: use ±30%.
    out[id] = base.central === 0 ? { low: x * 0.7, central: x, high: x * 1.3 } : recenter(base, x);
  }
  return out;
}

/** Move a range's central value to `central`, scaling low/high proportionally (keeps relative uncertainty). */
export function recenter(range: Range, central: number): Range {
  if (range.central === 0) return { low: central, central, high: central };
  const k = central / range.central;
  return { low: range.low * k, central, high: range.high * k };
}

export type Point = "low" | "central" | "high";

export function valuesAt(set: AssumptionSet, point: Point = "central"): Values {
  const v: Values = {};
  for (const [id, a] of Object.entries(set.assumptions)) v[id] = a.value[point];
  return v;
}

/** Read a value, failing loudly on unknown ids (catches typos instead of producing NaN). */
export function get(v: Values, id: string): number {
  const x = v[id];
  if (x === undefined) throw new Error(`Unknown assumption id: ${id}`);
  return x;
}

/** Wrap a Values object so every id read is recorded (for provenance: assumptionsUsed). */
export function tracked(v: Values): { values: Values; used: Set<string> } {
  const used = new Set<string>();
  const values = new Proxy(v, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && prop in target) used.add(prop);
      return Reflect.get(target, prop, receiver);
    },
  });
  return { values, used };
}
