// Carbon, water and cost for a query (spec §6.2), plus the full-cost line via the A↔B link.
import { get } from "./assumptions";
import { energyAtBoundary, queryEnergy, type QueryEnergy } from "./queryEnergy";
import { tcoFromValues } from "./tco";
import type { QueryInput, Values } from "./types";

export type ImpactOptions = { includeEmbodied: boolean };

export type ImpactPoint = {
  energy: QueryEnergy;
  energyWh: number;
  carbonG: number;
  waterMl: number;
  energyCostUsd: number;
  fullCostUsd: number;
};

export const gridId = (region: string, key: "intensity" | "price" | "wue_offsite") => `grid.${region}.${key}`;

export function impactsAtPoint(input: QueryInput, v: Values, opts: ImpactOptions): ImpactPoint {
  const energy = queryEnergy(input, v);
  const kWh = energy.facilityWh / 1000;

  let carbonG = kWh * get(v, gridId(input.region, "intensity"));
  let waterMl = kWh * (get(v, "wue.onsite") + get(v, gridId(input.region, "wue_offsite"))) * 1000;
  const energyCostUsd = kWh * get(v, gridId(input.region, "price"));

  if (opts.includeEmbodied) {
    carbonG += energy.outputTokensTotal * get(v, "embodied.carbon_per_token");
    waterMl += energy.outputTokensTotal * get(v, "embodied.water_per_token");
  }

  // Full cost = this query's IT energy × (hardware + facility + other opex per IT kWh from Module B)
  // + this query's own electricity cost. Allocating by IT energy (not facility energy) means a PUE change
  // only moves the electricity line. Equivalent to tokens × cost/token (spec §6.4), see METHODOLOGY.md.
  const fullCostUsd = (energy.itWh / 1000) * tcoFromValues(v).nonEnergyCostPerITKWh + energyCostUsd;

  return { energy, energyWh: energyAtBoundary(energy, input.boundary), carbonG, waterMl, energyCostUsd, fullCostUsd };
}

export type LineMetric = "energy" | "carbon" | "water" | "energyCost" | "fullCost";

/** Which assumption ids feed each receipt line (for source tooltips and unverified flags). */
export function lineAssumptionIds(input: QueryInput, opts: ImpactOptions, metric: LineMetric): string[] {
  const energy = [`e_out.${input.modelClass}`, "prefill_ratio"];
  if (input.reasoning && input.reasoningTokens === undefined) energy.push("reasoning_multiplier");
  const facility = [...energy, "server_overhead", "pue.hyperscale"];
  switch (metric) {
    case "energy":
      if (input.boundary === "gpu_only") return energy;
      if (input.boundary === "it_load") return [...energy, "server_overhead"];
      return facility;
    case "carbon":
      return [...facility, gridId(input.region, "intensity"), ...(opts.includeEmbodied ? ["embodied.carbon_per_token"] : [])];
    case "water":
      return [...facility, "wue.onsite", gridId(input.region, "wue_offsite"), ...(opts.includeEmbodied ? ["embodied.water_per_token"] : [])];
    case "energyCost":
      return [...facility, gridId(input.region, "price")];
    case "fullCost":
      return [
        ...facility,
        gridId(input.region, "price"),
        "tco.capex.servers", "tco.capex.facility", "tco.capex.network", "tco.capex.land", "tco.capex.utility",
        "tco.lifespan.it", "tco.lifespan.facility", "tco.cost_of_capital", "tco.utilization", "tco.pue", "tco.capacity_mw",
        "tco.opex.taxes", "tco.opex.maintenance", "tco.opex.labor", "tco.opex.water",
      ];
  }
}
