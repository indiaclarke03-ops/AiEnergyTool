import type { Range } from "../engine";
import { formatRange } from "./format";

/**
 * Central value with its low–high band, plus a small band diagram (triangular distribution) shown on hover/focus.
 * Never shows a single unqualified number.
 */
export function RangeValue({ value, unit, size = "md" }: { value: Range; unit: string; size?: "sm" | "md" | "lg" }) {
  const f = formatRange(value, unit);
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";
  const aria = `${f.central} ${f.unit}, range ${f.band} ${f.unit} (5th–95th percentile)`;
  return (
    <span className="group relative inline-flex items-baseline gap-1.5 font-mono" tabIndex={0} aria-label={aria}>
      <span className={`${text} font-semibold`}>
        {f.central}
        {f.unit && <span className="ml-0.5 text-[0.8em] font-normal">{f.unit}</span>}
      </span>
      <span className="text-xs text-stone-500" aria-hidden>
        ({f.band})
      </span>
      <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden rounded border border-stone-300 bg-white p-2 shadow group-hover:block group-focus:block">
        <Distribution value={value} />
        <span className="mt-1 block text-[10px] font-sans text-stone-500">p5 · central · p95 (Monte Carlo)</span>
      </span>
    </span>
  );
}

function Distribution({ value }: { value: Range }) {
  const w = 160;
  const h = 40;
  const span = value.high - value.low || 1;
  const x = (v: number) => 4 + ((v - value.low) / span) * (w - 8);
  return (
    <svg width={w} height={h} aria-hidden>
      <polygon points={`${x(value.low)},${h - 6} ${x(value.central)},6 ${x(value.high)},${h - 6}`} fill="#56b4e955" stroke="#0072b2" />
      <line x1={x(value.central)} x2={x(value.central)} y1={4} y2={h - 4} stroke="#1c1917" strokeDasharray="2 2" />
    </svg>
  );
}
