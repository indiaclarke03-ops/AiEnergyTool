// Linking Module A ↔ Module B: cost per token (spec §6.4) and the cost-vs-externality headline.
import { get } from "./assumptions";
import { facilityWhPerToken, itWhPerToken } from "./queryEnergy";
import { gridId } from "./impacts";
import { tcoFromValues, type TcoResult } from "./tco";
import type { ModelClass, Values } from "./types";

export type CostPerToken = {
  facilityWhPerToken: number;
  tokensPerYear: number;
  costPerMTokFull: number;
  costPerMTokEnergy: number;
};

export function costPerToken(tco: TcoResult, modelClass: ModelClass, v: Values): CostPerToken {
  // Tokens served scale with IT energy; equals spec §6.4 (facility kWh ÷ facility Wh/token) when PUEs match.
  const tokensPerYear = (tco.annualITKWh * 1000) / itWhPerToken(modelClass, v);
  return {
    facilityWhPerToken: facilityWhPerToken(modelClass, v),
    tokensPerYear,
    costPerMTokFull: (tco.annualTCO / tokensPerYear) * 1e6,
    costPerMTokEnergy: (tco.annualEnergyCost / tokensPerYear) * 1e6,
  };
}

/** Provider price ÷ estimated full cost. >1 suggests a margin, <1 a subsidy. */
export const priceToCostRatio = (apiPricePerMTok: number, c: CostPerToken) => apiPricePerMTok / c.costPerMTokFull;

export type Externalities = {
  operationalCarbonT: number;
  embodiedCarbonT: number;
  waterM3: number;
  /** $ value of externalities caused by energy use (operational carbon + water). */
  energyExternalityUsd: number;
  /** $ value of all externalities counted (adds embodied carbon of hardware and buildings). */
  totalExternalityUsd: number;
  energyShareOfExternality: number;
};

/** Annual externalities of the Module B facility, priced with the social cost of carbon and a water shadow price. */
export function facilityExternalities(tco: TcoResult, region: string, v: Values): Externalities {
  const mw = get(v, "tco.capacity_mw");
  const operationalCarbonT = (tco.annualEnergyKWh * get(v, gridId(region, "intensity"))) / 1e6;
  const embodiedCarbonT =
    (mw * get(v, "tco.embodied.server_t_per_mw")) / get(v, "tco.lifespan.it") +
    (mw * get(v, "tco.embodied.facility_t_per_mw")) / get(v, "tco.lifespan.facility");
  const waterM3 = tco.annualEnergyKWh * (get(v, "wue.onsite") + get(v, gridId(region, "wue_offsite"))) / 1000;

  const scc = get(v, "ext.scc");
  const energyExternalityUsd = operationalCarbonT * scc + waterM3 * get(v, "ext.water_value");
  const totalExternalityUsd = energyExternalityUsd + embodiedCarbonT * scc;
  return {
    operationalCarbonT,
    embodiedCarbonT,
    waterM3,
    energyExternalityUsd,
    totalExternalityUsd,
    energyShareOfExternality: energyExternalityUsd / totalExternalityUsd,
  };
}

export type ModuleBMetrics = {
  annualTCO: number;
  energyShare: number;
  costPerMTokFull: number;
  costPerMTokEnergy: number;
  energyShareOfExternality: number;
  operationalCarbonT: number;
};

/** Headline Module B metrics at one point — the function Monte Carlo and the tornado chart run over. */
export function moduleBAtPoint(v: Values, modelClass: ModelClass, region: string): ModuleBMetrics {
  const tco = tcoFromValues(v);
  const c = costPerToken(tco, modelClass, v);
  const e = facilityExternalities(tco, region, v);
  return {
    annualTCO: tco.annualTCO,
    energyShare: tco.energyShare,
    costPerMTokFull: c.costPerMTokFull,
    costPerMTokEnergy: c.costPerMTokEnergy,
    energyShareOfExternality: e.energyShareOfExternality,
    operationalCarbonT: e.operationalCarbonT,
  };
}
