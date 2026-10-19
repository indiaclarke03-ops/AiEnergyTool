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

  // Full cost = this query's facility energy × (hardware + facility + other opex per kWh from Module B)
  // + this query's own electricity cost. Equivalent to tokens × cost/token (spec §6.4), see METHODOLOGY.md.
  const fullCostUsd = kWh * tcoFromValues(v).nonEnergyCostPerKWh + energyCostUsd;

  return { energy, energyWh: energyAtBoundary(energy, input.boundary), carbonG, waterMl, energyCostUsd, fullCostUsd };
}
