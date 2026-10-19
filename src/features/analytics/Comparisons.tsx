import { useDeferredValue, useMemo } from "react";
import { estimateQuery, type ImpactEstimate, type Range } from "../../engine";
import { formatRange } from "../../components/format";
import { SERIES } from "../../components/Chart";
import { useAppStore, useAssumptions } from "../../store/useAppStore";

const METRICS: { key: "energyWh" | "carbonG" | "waterMl" | "fullCostUsd"; label: string; unit: string }[] = [
  { key: "energyWh", label: "Energy", unit: "Wh" },
  { key: "carbonG", label: "Carbon", unit: "g" },
  { key: "waterMl", label: "Water", unit: "mL" },
  { key: "fullCostUsd", label: "Full cost", unit: "$" },
];

/** Small multiples: one panel per metric, comparing model classes (top row) and regions (bottom row) for the current query. */
export function Comparisons() {
  const set = useAssumptions();
  const { query, includeEmbodied } = useAppStore();
  const d = useDeferredValue({ set, query, includeEmbodied });

  const byModel = useMemo(
    () =>
      d.set.modelClasses.map((m) => ({
        label: m.key,
        e: estimateQuery({ ...d.query, modelClass: m.key }, d.set, { includeEmbodied: d.includeEmbodied, mc: { n: 1500 } }),
      })),
    [d],
  );
  const byRegion = useMemo(
    () =>
      d.set.regions.map((r) => ({
        label: r.label,
        e: estimateQuery({ ...d.query, region: r.key }, d.set, { includeEmbodied: d.includeEmbodied, mc: { n: 1500 } }),
      })),
    [d],
  );

  return (
    <section aria-labelledby="cmp-heading" className="rounded-lg border border-stone-200 bg-white p-4" data-testid="comparisons">
      <h2 id="cmp-heading" className="text-base font-semibold">
        Comparisons
      </h2>
      <p className="mb-3 text-xs text-stone-500">
        The current Receipt query ({query.inputTokens} in / {query.outputTokens} out{query.reasoning ? ", reasoning" : ""}) re-estimated per model class and per
        region. Bars: central; whiskers: p5–p95. Each panel has its own scale; hover a bar for values.
      </p>
      <h3 className="mb-1 text-sm font-semibold">
        By model class <span className="font-normal text-stone-500">(region: {query.region})</span>
      </h3>
      <Grid rows={byModel} color={SERIES.s1} />
      <h3 className="mb-1 mt-4 text-sm font-semibold">
        By region <span className="font-normal text-stone-500">(model: {query.modelClass})</span>
      </h3>
      <Grid rows={byRegion} color={SERIES.s3} />
    </section>
  );
}

function Grid({ rows, color }: { rows: { label: string; e: ImpactEstimate }[]; color: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {METRICS.map((m) => {
        const max = Math.max(...rows.map((r) => r.e[m.key].high));
        return (
          <figure key={m.key} className="rounded border border-stone-100 p-2">
            <figcaption className="mb-1 text-xs font-semibold text-stone-600">{m.label}</figcaption>
            <ul className="space-y-1">
              {rows.map((r) => (
                <Bar key={r.label} label={r.label} value={r.e[m.key]} unit={m.unit} max={max} color={color} />
              ))}
            </ul>
          </figure>
        );
      })}
    </div>
  );
}

function Bar({ label, value, unit, max, color }: { label: string; value: Range; unit: string; max: number; color: string }) {
  const f = formatRange(value, unit);
  const pct = (x: number) => (x / max) * 100;
  const text = `${label}: ${f.central} ${f.unit} (${f.band})`;
  return (
    <li className="group grid grid-cols-[6.5rem_1fr] items-center gap-2 text-[11px]" title={text} aria-label={text}>
      <span className="truncate text-stone-600">{label}</span>
      <span className="relative h-3.5 rounded-sm group-hover:bg-stone-100">
        <span className="absolute inset-y-0 left-0 rounded-r" style={{ width: `${pct(value.central)}%`, background: color }} />
        <span className="absolute top-1/2 h-px bg-stone-800" style={{ left: `${pct(value.low)}%`, width: `${pct(value.high) - pct(value.low)}%` }} />
        <span className="absolute top-0.5 bottom-0.5 w-px bg-stone-800" style={{ left: `${pct(value.high)}%` }} />
      </span>
    </li>
  );
}
