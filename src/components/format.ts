import type { Range } from "../engine";

/** Format with ~3 significant figures, without scientific notation for everyday magnitudes. */
export function sig(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return "—";
  if (x === 0) return "0";
  const abs = Math.abs(x);
  if (abs >= 1e15 || abs < 1e-6) return x.toExponential(digits - 1);
  const decimals = Math.max(0, digits - 1 - Math.floor(Math.log10(abs)));
  return x.toLocaleString("en-US", { maximumFractionDigits: Math.min(decimals, 10), minimumFractionDigits: 0 });
}

type Scale = { factor: number; unit: string };

const SCALES: Record<string, Scale[]> = {
  Wh: [
    { factor: 1, unit: "Wh" },
    { factor: 1e3, unit: "kWh" },
    { factor: 1e6, unit: "MWh" },
    { factor: 1e9, unit: "GWh" },
    { factor: 1e12, unit: "TWh" },
  ],
  g: [
    { factor: 1, unit: "g" },
    { factor: 1e3, unit: "kg" },
    { factor: 1e6, unit: "t" },
    { factor: 1e9, unit: "kt" },
    { factor: 1e12, unit: "Mt" },
  ],
  mL: [
    { factor: 1, unit: "mL" },
    { factor: 1e3, unit: "L" },
    { factor: 1e6, unit: "m³" },
    { factor: 1e9, unit: "thousand m³" },
    { factor: 1e12, unit: "million m³" },
  ],
  $: [
    { factor: 1, unit: "" },
    { factor: 1e3, unit: "K" },
    { factor: 1e6, unit: "M" },
    { factor: 1e9, unit: "B" },
  ],
};

/** Pick a display scale based on the central value so low/central/high share one unit. */
export function pickScale(unit: string, central: number): Scale {
  const scales = SCALES[unit];
  if (!scales) return { factor: 1, unit };
  const abs = Math.abs(central);
  let chosen = scales[0]!;
  for (const s of scales) if (abs >= s.factor) chosen = s;
  return chosen;
}

export function formatQty(x: number, unit: string): string {
  const s = pickScale(unit, x);
  if (unit === "$") return `$${sig(x / s.factor)}${s.unit}`;
  return `${sig(x / s.factor)} ${s.unit}`;
}

export function formatRange(r: Range, unit: string): { central: string; band: string; unit: string } {
  const s = pickScale(unit, r.central);
  const f = (x: number) => (unit === "$" ? `$${sig(x / s.factor)}${s.unit}` : sig(x / s.factor));
  return { central: f(r.central), band: `${f(r.low)}–${f(r.high)}`, unit: unit === "$" ? "" : s.unit };
}

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

export const scaleRange = (r: Range, k: number): Range => ({ low: r.low * k, central: r.central * k, high: r.high * k });
