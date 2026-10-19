// Output metrics available to the sensitivity and uncertainty views.
import { formatQty } from "../../components/format";
import { impactsAtPoint, moduleBAtPoint, type QueryInput, type Values } from "../../engine";

export type OutputCtx = { query: QueryInput; includeEmbodied: boolean; region: string };

export type OutputDef = { id: string; label: string; unit: string; fn: (ctx: OutputCtx) => (v: Values) => number };

export const OUTPUTS: OutputDef[] = [
  { id: "carbon", label: "gCO₂e per query", unit: "g", fn: (c) => (v) => impactsAtPoint(c.query, v, c).carbonG },
  { id: "energy", label: "Wh per query (selected boundary)", unit: "Wh", fn: (c) => (v) => impactsAtPoint(c.query, v, c).energyWh },
  { id: "water", label: "mL water per query", unit: "mL", fn: (c) => (v) => impactsAtPoint(c.query, v, c).waterMl },
  { id: "fullCost", label: "Fully loaded $ per query", unit: "$", fn: (c) => (v) => impactsAtPoint(c.query, v, c).fullCostUsd },
  { id: "costPerMTok", label: "$ per M tokens (full)", unit: "$", fn: (c) => (v) => moduleBAtPoint(v, c.query.modelClass, c.region).costPerMTokFull },
  { id: "annualTCO", label: "Annual TCO", unit: "$", fn: (c) => (v) => moduleBAtPoint(v, c.query.modelClass, c.region).annualTCO },
  { id: "energyShare", label: "Energy share of cost", unit: "%", fn: (c) => (v) => moduleBAtPoint(v, c.query.modelClass, c.region).energyShare },
  { id: "extShare", label: "Energy share of externalities", unit: "%", fn: (c) => (v) => moduleBAtPoint(v, c.query.modelClass, c.region).energyShareOfExternality },
];

export const formatOutput = (x: number, unit: string): string => (unit === "%" ? `${(x * 100).toFixed(1)}%` : formatQty(x, unit));
