import { useDeferredValue, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { runMonteCarlo, tornado } from "../../engine";
import { Chart, INK, SERIES } from "../../components/Chart";
import { UnverifiedFlag } from "../../components/UnverifiedFlag";
import { useAppStore, useAssumptions } from "../../store/useAppStore";
import { OUTPUTS, formatOutput } from "./outputs";

const TOP_N = 12;

/** Tornado (one-at-a-time sensitivity) and Monte Carlo histogram for a chosen output. */
export function Uncertainty() {
  const set = useAssumptions();
  const { query, includeEmbodied, tcoRegion } = useAppStore();
  const [outputId, setOutputId] = useState("carbon");
  const def = OUTPUTS.find((o) => o.id === outputId)!;
  const d = useDeferredValue({ set, query, includeEmbodied, tcoRegion, def });

  const { torn, mc } = useMemo(() => {
    const fn = d.def.fn({ query: d.query, includeEmbodied: d.includeEmbodied, region: d.tcoRegion });
    return {
      torn: tornado(d.set, fn),
      mc: runMonteCarlo(d.set, (v) => ({ y: fn(v) }), { n: 5000, bins: 40 }).metrics.y!,
    };
  }, [d]);

  const fmt = (x: number) => formatOutput(x, def.unit);
  const bars = torn.bars.slice(0, TOP_N).reverse();

  const tornadoOption: EChartsOption = {
    grid: { left: 260, right: 70, top: 28, bottom: 28 },
    legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: INK.secondary } },
    xAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: INK.grid } },
      // Bars are deltas from the baseline; label the axis in absolute terms.
      axisLabel: { color: INK.secondary, formatter: (x: number) => fmt(torn.baseline + x) },
    },
    yAxis: {
      type: "category",
      data: bars.map((b) => `${b.verified ? "" : "⚠ "}${b.label}`),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: INK.grid } },
      axisLabel: { color: INK.primary, width: 250, overflow: "truncate", fontSize: 11 },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (ps: unknown) => {
        const p = (ps as { dataIndex: number }[])[0]!;
        const b = bars[p.dataIndex]!;
        return `${b.label}<br/>at low: <b>${fmt(b.outputAtLow)}</b><br/>at high: <b>${fmt(b.outputAtHigh)}</b><br/>baseline ${fmt(torn.baseline)}${b.verified ? "" : "<br/>⚠ unverified"}`;
      },
    },
    series: [
      {
        name: "Assumption at low",
        type: "bar",
        stack: "t",
        barWidth: 12,
        itemStyle: { color: SERIES.s1, borderRadius: 2 },
        data: bars.map((b) => b.outputAtLow - torn.baseline),
      },
      {
        name: "Assumption at high",
        type: "bar",
        stack: "t2",
        barWidth: 12,
        barGap: "-100%",
        itemStyle: { color: SERIES.s2, borderRadius: 2 },
        data: bars.map((b) => b.outputAtHigh - torn.baseline),
      },
    ],
  };
  const edges = mc.histogram.binEdges;
  const centers = edges.slice(0, -1).map((e, i) => (e + edges[i + 1]!) / 2);
  const binOf = (x: number) => {
    const width = (edges[edges.length - 1]! - edges[0]!) / centers.length || 1;
    return Math.min(centers.length - 1, Math.max(0, Math.floor((x - edges[0]!) / width)));
  };
  const histOption: EChartsOption = {
    grid: { left: 48, right: 16, top: 28, bottom: 36 },
    xAxis: {
      type: "category",
      data: centers.map(fmt),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: INK.grid } },
      axisLabel: { color: INK.secondary, interval: 7, fontSize: 10 },
    },
    yAxis: { type: "value", name: "samples", splitLine: { lineStyle: { color: INK.grid } }, axisLabel: { color: INK.secondary } },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: unknown) => { const p = (ps as { dataIndex: number; value: number }[])[0]!; return `${fmt(edges[p.dataIndex]!)} – ${fmt(edges[p.dataIndex + 1]!)}<br/><b>${p.value}</b> samples`; } },
    series: [
      {
        type: "bar",
        barCategoryGap: "8%",
        itemStyle: { color: SERIES.s1, borderRadius: [2, 2, 0, 0] },
        data: mc.histogram.counts,
        markLine: {
          symbol: "none",
          silent: true,
          lineStyle: { color: INK.primary, type: "dashed" },
          label: { color: INK.primary, fontSize: 10, formatter: (p: { name?: string }) => p.name ?? "" },
          data: (
            [
              ["p5", mc.p5],
              ["p50", mc.p50],
              ["p95", mc.p95],
            ] as const
          ).map(([name, x]) => ({ name, xAxis: binOf(x) })),
        },
      },
    ],
  };

  return (
    <section aria-labelledby="unc-heading" className="rounded-lg border border-stone-200 bg-white p-4" data-testid="uncertainty">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="unc-heading" className="text-base font-semibold">
          Sensitivity &amp; uncertainty
        </h2>
        <label className="text-sm">
          Output{" "}
          <select id="output-select" className="rounded border border-stone-300 px-2 py-1" value={outputId} onChange={(e) => setOutputId(e.target.value)}>
            {OUTPUTS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <figure>
          <figcaption className="mb-1 text-sm font-semibold">
            Tornado: which assumptions move it most{" "}
            <span className="font-normal text-stone-500">(each swept low→high, others at central; top {TOP_N})</span>
          </figcaption>
          <Chart option={tornadoOption} height={Math.max(220, bars.length * 26 + 60)} label={`Tornado chart for ${def.label}: ${torn.bars.slice(0, 5).map((b) => b.label).join(", ")} have the largest effect`} />
          <p className="flex items-center gap-1 text-[11px] text-stone-500">
            <UnverifiedFlag /> marks unverified assumptions. Baseline: {fmt(torn.baseline)}.
          </p>
        </figure>
        <figure>
          <figcaption className="mb-1 text-sm font-semibold">
            Monte Carlo distribution <span className="font-normal text-stone-500">(5,000 samples, triangular)</span>
          </figcaption>
          <Chart option={histOption} height={260} label={`Histogram of ${def.label}: p5 ${fmt(mc.p5)}, median ${fmt(mc.p50)}, p95 ${fmt(mc.p95)}`} />
          <dl className="mt-1 grid grid-cols-3 gap-2 text-center text-sm" data-testid="mc-stats">
            {(
              [
                ["p5", mc.p5],
                ["p50", mc.p50],
                ["p95", mc.p95],
              ] as const
            ).map(([k, x]) => (
              <div key={k} className="rounded bg-stone-50 p-1.5">
                <dt className="text-xs text-stone-500">{k}</dt>
                <dd className="font-mono font-semibold">{fmt(x)}</dd>
              </div>
            ))}
          </dl>
        </figure>
      </div>
    </section>
  );
}
