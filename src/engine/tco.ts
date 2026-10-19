// Module B: data center total cost of ownership (spec §6.3).
import { get } from "./assumptions";
import type { Values } from "./types";

export type TcoParams = {
  capacityMW: number;
  capex: { servers: number; facility: number; network: number; land: number; utility: number };
  lifespanIT: number;
  lifespanFacility: number;
  electricityPrice: number;
  utilization: number;
  pue: number;
  opex: { taxes: number; maintenance: number; labor: number; water: number; colocation: number };
  costOfCapital: number;
};

export type TcoResult = {
  annualCapex: { servers: number; facility: number; network: number; land: number; utility: number };
  annualCapexTotal: number;
  /** IT energy (before PUE). Tokens served scale with this, not with facility energy. */
  annualITKWh: number;
  annualEnergyKWh: number;
  annualEnergyCost: number;
  otherOpex: TcoParams["opex"];
  otherOpexTotal: number;
  annualTCO: number;
  energyShare: number;
  /** Everything except electricity, per kWh of IT energy. Used by the A↔B link. */
  nonEnergyCostPerITKWh: number;
};

export function tcoParamsFromValues(v: Values): TcoParams {
  return {
    capacityMW: get(v, "tco.capacity_mw"),
    capex: {
      servers: get(v, "tco.capex.servers"),
      facility: get(v, "tco.capex.facility"),
      network: get(v, "tco.capex.network"),
      land: get(v, "tco.capex.land"),
      utility: get(v, "tco.capex.utility"),
    },
    lifespanIT: get(v, "tco.lifespan.it"),
    lifespanFacility: get(v, "tco.lifespan.facility"),
    electricityPrice: get(v, "tco.electricity_price"),
    utilization: get(v, "tco.utilization"),
    pue: get(v, "tco.pue"),
    opex: {
      taxes: get(v, "tco.opex.taxes"),
      maintenance: get(v, "tco.opex.maintenance"),
      labor: get(v, "tco.opex.labor"),
      water: get(v, "tco.opex.water"),
      colocation: get(v, "tco.opex.colocation"),
    },
    costOfCapital: get(v, "tco.cost_of_capital"),
  };
}

/** Capital recovery factor: straight-line when r = 0, annuity otherwise. */
export function capitalRecoveryFactor(r: number, years: number): number {
  if (years <= 0) throw new Error("Lifespan must be positive");
  if (r === 0) return 1 / years;
  return r / (1 - Math.pow(1 + r, -years));
}

export const HOURS_PER_YEAR = 8760;

export function computeTco(p: TcoParams): TcoResult {
  const crfIT = capitalRecoveryFactor(p.costOfCapital, p.lifespanIT);
  const crfFacility = capitalRecoveryFactor(p.costOfCapital, p.lifespanFacility);
  const annualCapex = {
    servers: p.capex.servers * crfIT,
    network: p.capex.network * crfIT,
    facility: p.capex.facility * crfFacility,
    utility: p.capex.utility * crfFacility,
    // Land does not depreciate: its annual cost is the opportunity cost of the capital tied up in it.
    land: p.capex.land * p.costOfCapital,
  };
  const annualCapexTotal = Object.values(annualCapex).reduce((s, x) => s + x, 0);

  const annualITKWh = p.capacityMW * 1000 * HOURS_PER_YEAR * p.utilization;
  const annualEnergyKWh = annualITKWh * p.pue;
  const annualEnergyCost = annualEnergyKWh * p.electricityPrice;
  const otherOpexTotal = Object.values(p.opex).reduce((s, x) => s + x, 0);
  const annualTCO = annualCapexTotal + annualEnergyCost + otherOpexTotal;

  return {
    annualCapex,
    annualCapexTotal,
    annualITKWh,
    annualEnergyKWh,
    annualEnergyCost,
    otherOpex: p.opex,
    otherOpexTotal,
    annualTCO,
    energyShare: annualEnergyCost / annualTCO,
    nonEnergyCostPerITKWh: (annualCapexTotal + otherOpexTotal) / annualITKWh,
  };
}

export const tcoFromValues = (v: Values) => computeTco(tcoParamsFromValues(v));
