// Core types shared by every module. Pure TS — no UI imports.

export type Range = { low: number; central: number; high: number };

export type Boundary = "gpu_only" | "it_load" | "facility" | "lifecycle";
export type QueryBoundary = Exclude<Boundary, "lifecycle">;

export type Source = { title: string; url: string; note?: string };

export type Assumption = {
  id: string;
  label: string;
  unit: string;
  value: Range;
  boundary?: Boundary;
  sources: Source[];
  verified: boolean;
  notes?: string;
};

export type ModelClass = "small" | "medium" | "frontier";

export type ModelClassInfo = { key: ModelClass; label: string; energyAssumption: string };
export type Region = { key: string; label: string };

export type Actor = "user" | "provider" | "policy";
export type Metric = "energy" | "carbon" | "water" | "cost";

export type LeverKind = "reasoning_off" | "model_downsize" | "multiply" | "set" | "region_switch";

export type Lever = {
  id: string;
  label: string;
  description: string;
  actors: Actor[];
  metrics: Metric[];
  kind: LeverKind;
  targets?: string[];
  effectAssumption?: string;
  targetRegion?: string;
  /** For "set" levers: whether a lower or higher value of the target is the improvement. */
  improves?: "lower" | "higher";
  sources: Source[];
  verified: boolean;
};

/** Every assumption file loaded and validated, keyed by id. */
export type AssumptionSet = {
  versions: Record<string, string>;
  assumptions: Record<string, Assumption>;
  modelClasses: ModelClassInfo[];
  regions: Region[];
  levers: Lever[];
};

/** A single point drawn from the assumption ranges (central, low, high, or a Monte Carlo sample). */
export type Values = Record<string, number>;

export type QueryInput = {
  modelClass: ModelClass;
  modelName?: string;
  inputTokens: number;
  outputTokens: number;
  reasoning: boolean;
  reasoningTokens?: number;
  region: string;
  boundary: QueryBoundary;
  modality: "text";
};

export type ImpactEstimate = {
  energyWh: Range;
  carbonG: Range;
  waterMl: Range;
  energyCostUsd: Range;
  fullCostUsd: Range;
  /** Boundary of the energy line (selected by the user). */
  boundary: QueryBoundary;
  /** Boundary of carbon / water / cost lines: facility, or lifecycle when embodied impacts are included. */
  impactBoundary: "facility" | "lifecycle";
  assumptionsUsed: string[];
};
