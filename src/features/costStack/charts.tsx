import type { EChartsOption } from "echarts";
import { computeTco, costPerToken, type ModelClass, type TcoParams, type TcoResult, type Values } from "../../engine";
import { Chart, INK, SERIES } from "../../components/Chart";

const B = (x: number) => x / 1e9;
const usdB = (x: number) => `$${B(x).toFixed(2)}B`;
const axis = { axisLine: { lineStyle: { color: INK.grid } }, axisTick: { show: false }, axisLabel: { color: INK.secondary }, splitLine: { lineStyle: { color: INK.grid } } };

export type Component = { name: string; value: number; group: "capex" | "energy" | "opex" };

export function components(t: TcoResult): Component[] {
  return [
    { name: "Servers", value: t.annualCapex.servers, group: "capex" },
    { name: "Network", value: t.annualCapex.network, group: "capex" },
    { name: "Facility", value: t.annualCapex.facility, group: "capex" },
    { name: "Land/utility", value: t.annualCapex.land + t.annualCapex.utility, group: "capex" },
    { name: "Energy", value: t.annualEnergyCost, group: "energy" },
    { name: "Other opex", value: t.otherOpexTotal, group: "opex" },
  ];
}

const groupColor = { capex: SERIES.s1, energy: SERIES.s2, opex: SERIES.s3 };

/** Waterfall: annual TCO built up component by component. */
export function Waterfall({ tco }: { tco: TcoResult }) {
  const comps = components(tco);
  let running = 0;
  const bases: number[] = [];
  for (const c of comps) {
    bases.push(running);
    running += c.value;
  }
  const names = [...comps.map((c) => c.name), "Annual TCO"];
  const option: EChartsOption = {
    grid: { left: 56, right: 12, top: 24, bottom: 28 },
    xAxis: { type: "category", data: names, ...axis, splitLine: { show: false }, axisLabel: { color: INK.secondary, interval: 0, fontSize: 10 } },
    yAxis: { type: "value", ...axis, axisLabel: { color: INK.secondary, formatter: (v: number) => `$${B(v)}B` } },
    tooltip: {
      trigger: "item",
      formatter: (p: unknown) => {
        const { dataIndex } = p as { dataIndex: number };
        const v = dataIndex < comps.length ? comps[dataIndex]!.value : tco.annualTCO;
        return `${names[dataIndex]}<br/><b>${usdB(v)}/yr</b> · ${((v / tco.annualTCO) * 100).toFixed(1)}% of TCO`;
      },
    },
    series: [
      { type: "bar", stack: "w", silent: true, itemStyle: { color: "transparent" }, data: [...bases, 0] },
      {
        type: "bar",
        stack: "w",
        barMaxWidth: 36,
        data: [
          ...comps.map((c) => ({ value: c.value, itemStyle: { color: groupColor[c.group], borderRadius: [4, 4, 0, 0] } })),
          { value: tco.annualTCO, itemStyle: { color: INK.secondary, borderRadius: [4, 4, 0, 0] } },
        ],
        label: { show: true, position: "top", color: INK.primary, fontSize: 10, formatter: (p: { value: unknown }) => usdB(Number(p.value)) },
      },
    ],
  };
  return <Chart option={option} height={260} label={`Waterfall of annual TCO: ${comps.map((c) => `${c.name} ${usdB(c.value)}`).join(", ")}; total ${usdB(tco.annualTCO)}`} />;
}

/** 100% stacked bar: capex vs energy vs other opex. */
export function CostMix({ tco }: { tco: TcoResult }) {
  const parts = [
    { name: "Capital (annualized)", value: tco.annualCapexTotal, color: SERIES.s1 },
    { name: "Energy", value: tco.annualEnergyCost, color: SERIES.s2 },
    { name: "Other opex", value: tco.otherOpexTotal, color: SERIES.s3 },
  ];
  const option: EChartsOption = {
    grid: { left: 8, right: 8, top: 28, bottom: 8 },
    legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: INK.secondary } },
    xAxis: { type: "value", max: 1, show: false },
    yAxis: { type: "category", data: [""], show: false },
    tooltip: { trigger: "item", formatter: (p: unknown) => { const q = p as { seriesName: string; value: number }; return `${q.seriesName}: <b>${(q.value * 100).toFixed(1)}%</b>`; } },
    series: parts.map((p) => ({
      name: p.name,
      type: "bar",
      stack: "mix",
      barWidth: 28,
      itemStyle: { color: p.color, borderColor: INK.surface, borderWidth: 2 },
      label: { show: p.value / tco.annualTCO > 0.04, color: "#fff", fontWeight: "bold", formatter: () => `${((p.value / tco.annualTCO) * 100).toFixed(0)}%` },
      data: [p.value / tco.annualTCO],
    })),
  };
  return <Chart option={option} height={80} label={`Cost mix: ${parts.map((p) => `${p.name} ${((p.value / tco.annualTCO) * 100).toFixed(1)}%`).join(", ")}`} />;
}

/** Sankey: annual $ → capex/opex → components → cost per million tokens. */
export function CostSankey({ tco, costPerMTok }: { tco: TcoResult; costPerMTok: number }) {
  const comps = components(tco).filter((c) => c.value > 0);
  const total = `Annual TCO ${usdB(tco.annualTCO)}`;
  const sink = `$${costPerMTok.toFixed(2)} per M tokens`;
  const capex = "Capital", opex = "Operating";
  const nodes = [
    { name: total, itemStyle: { color: INK.secondary } },
    { name: capex, itemStyle: { color: SERIES.s1 } },
    { name: opex, itemStyle: { color: SERIES.s3 } },
    ...comps.map((c) => ({ name: c.name, itemStyle: { color: groupColor[c.group] } })),
    { name: sink, itemStyle: { color: INK.secondary } },
  ];
  const capexTotal = comps.filter((c) => c.group === "capex").reduce((s, c) => s + c.value, 0);
  const links = [
    { source: total, target: capex, value: B(capexTotal) },
    { source: total, target: opex, value: B(tco.annualTCO - capexTotal) },
    ...comps.map((c) => ({ source: c.group === "capex" ? capex : opex, target: c.name, value: B(c.value) })),
    ...comps.map((c) => ({ source: c.name, target: sink, value: B(c.value) })),
  ];
  const option: EChartsOption = {
    tooltip: { trigger: "item", formatter: (p: unknown) => { const q = p as { name: string; value: number; dataType: string }; return q.dataType === "edge" ? `${q.name}: <b>$${q.value.toFixed(2)}B/yr</b>` : q.name; } },
    series: [
      {
        type: "sankey",
        left: 8,
        right: 150,
        top: 8,
        bottom: 8,
        nodeGap: 10,
        nodeWidth: 10,
        data: nodes,
        links,
        lineStyle: { color: "gradient", opacity: 0.35 },
        label: { color: INK.primary, fontSize: 11 },
        emphasis: { focus: "adjacency" },
      },
    ],
  };
  return <Chart option={option} height={300} label={`Sankey from annual TCO through components to ${sink}`} />;
}

/** Cost per million tokens vs utilization: fixed costs dominate when GPUs sit idle. */
export function UtilizationCurve({ params, v, modelClass }: { params: TcoParams; v: Values; modelClass: ModelClass }) {
  const xs = Array.from({ length: 19 }, (_, i) => 0.1 + i * 0.05);
  const pts = xs.map((u) => costPerToken(computeTco({ ...params, utilization: u }), modelClass, v));
  const current = params.utilization;
  const option: EChartsOption = {
    grid: { left: 56, right: 16, top: 32, bottom: 36 },
    legend: { top: 0, right: 0, itemWidth: 14, itemHeight: 2, textStyle: { color: INK.secondary } },
    xAxis: { type: "value", min: 0.1, max: 1, name: "Utilization", nameLocation: "middle", nameGap: 24, ...axis, axisLabel: { color: INK.secondary, formatter: (x: number) => `${Math.round(x * 100)}%` } },
    yAxis: { type: "value", ...axis, axisLabel: { color: INK.secondary, formatter: (x: number) => `$${x}` } },
    tooltip: { trigger: "axis", axisPointer: { type: "line" }, valueFormatter: (x) => `$${Number(x).toFixed(3)}` },
    series: [
      {
        name: "Full cost",
        type: "line",
        showSymbol: false,
        lineStyle: { width: 2, color: SERIES.s1 },
        itemStyle: { color: SERIES.s1 },
        data: xs.map((u, i) => [u, pts[i]!.costPerMTokFull]),
        markLine: { symbol: "none", silent: true, lineStyle: { color: INK.muted, type: "dashed" }, label: { formatter: "current", color: INK.secondary }, data: [{ xAxis: current }] },
      },
      { name: "Energy only", type: "line", showSymbol: false, lineStyle: { width: 2, color: SERIES.s2 }, itemStyle: { color: SERIES.s2 }, data: xs.map((u, i) => [u, pts[i]!.costPerMTokEnergy]) },
    ],
  };
  return <Chart option={option} height={260} label="Line chart of cost per million tokens against utilization, full cost falling steeply as utilization rises while energy-only cost stays flat" />;
}
