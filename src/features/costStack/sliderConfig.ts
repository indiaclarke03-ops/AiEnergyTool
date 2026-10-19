// Slider layout for Module B. Defaults and uncertainty come from datacenter_tco.json; these are only UI travel limits.
export type SliderFormat = "usdB" | "usdM" | "years" | "pct" | "usdKWh" | "ratio" | "mw" | "usdT" | "usdM3";

export type SliderSpec = { id: string; format: SliderFormat; min: number; max: number; step: number };

export const SLIDER_GROUPS: { title: string; sliders: SliderSpec[] }[] = [
  {
    title: "Facility",
    sliders: [
      { id: "tco.capacity_mw", format: "mw", min: 10, max: 5000, step: 10 },
      { id: "tco.utilization", format: "pct", min: 0.05, max: 1, step: 0.01 },
      { id: "tco.pue", format: "ratio", min: 1.02, max: 2, step: 0.01 },
    ],
  },
  {
    title: "Capital expenditure",
    sliders: [
      { id: "tco.capex.servers", format: "usdB", min: 0, max: 60e9, step: 0.1e9 },
      { id: "tco.capex.facility", format: "usdB", min: 0, max: 30e9, step: 0.1e9 },
      { id: "tco.capex.network", format: "usdB", min: 0, max: 15e9, step: 0.05e9 },
      { id: "tco.capex.land", format: "usdB", min: 0, max: 1e9, step: 0.01e9 },
      { id: "tco.capex.utility", format: "usdB", min: 0, max: 1e9, step: 0.01e9 },
    ],
  },
  {
    title: "Lifespan & finance",
    sliders: [
      { id: "tco.lifespan.it", format: "years", min: 2, max: 10, step: 0.5 },
      { id: "tco.lifespan.facility", format: "years", min: 5, max: 30, step: 1 },
      { id: "tco.cost_of_capital", format: "pct", min: 0, max: 0.15, step: 0.005 },
    ],
  },
  {
    title: "Operating costs",
    sliders: [
      { id: "tco.electricity_price", format: "usdKWh", min: 0.02, max: 0.3, step: 0.001 },
      { id: "tco.opex.taxes", format: "usdM", min: 0, max: 500e6, step: 1e6 },
      { id: "tco.opex.maintenance", format: "usdM", min: 0, max: 500e6, step: 1e6 },
      { id: "tco.opex.labor", format: "usdM", min: 0, max: 200e6, step: 1e6 },
      { id: "tco.opex.water", format: "usdM", min: 0, max: 50e6, step: 0.5e6 },
      { id: "tco.opex.colocation", format: "usdB", min: 0, max: 4e9, step: 0.05e9 },
    ],
  },
  {
    title: "Externality pricing",
    sliders: [
      { id: "ext.scc", format: "usdT", min: 0, max: 400, step: 5 },
      { id: "ext.water_value", format: "usdM3", min: 0, max: 20, step: 0.1 },
    ],
  },
];

export function formatSlider(x: number, f: SliderFormat): string {
  switch (f) {
    case "usdB":
      return `$${(x / 1e9).toFixed(2)}B`;
    case "usdM":
      return `$${(x / 1e6).toFixed(0)}M/yr`;
    case "years":
      return `${x} yr`;
    case "pct":
      return `${(x * 100).toFixed(1)}%`;
    case "usdKWh":
      return `$${x.toFixed(3)}/kWh`;
    case "ratio":
      return x.toFixed(2);
    case "mw":
      return x >= 1000 ? `${(x / 1000).toFixed(2)} GW` : `${x} MW`;
    case "usdT":
      return `$${x}/t`;
    case "usdM3":
      return `$${x.toFixed(1)}/m³`;
  }
}
