// Thin wrapper over tree-shaken ECharts, with shared chart tokens (reference categorical palette, recessive axes).
// The esm build avoids a CJS default-export interop issue with lib/core.
import EChartsReactCore from "echarts-for-react/esm/core";
import * as echarts from "echarts/core";
import { BarChart, CustomChart, LineChart, SankeyChart } from "echarts/charts";
import { GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

echarts.use([BarChart, LineChart, SankeyChart, CustomChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, SVGRenderer]);

/** Categorical slots in fixed order (validated: adjacent CVD ΔE ≥ 8, normal-vision ≥ 15). */
export const SERIES = {
  s1: "#2a78d6", // blue  — capital / hardware
  s2: "#eb6834", // orange — energy
  s3: "#1baf7a", // aqua  — other opex
  s4: "#eda100", // yellow
} as const;

export const INK = { primary: "#1c1917", secondary: "#57534e", muted: "#a8a29e", grid: "#e7e5e4", surface: "#ffffff" };

export const baseOption: EChartsOption = {
  textStyle: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: INK.secondary, fontSize: 11 },
  tooltip: { backgroundColor: "#fff", borderColor: INK.grid, textStyle: { color: INK.primary, fontSize: 12 } },
  animationDuration: 300,
};

export function Chart({ option, height = 260, label }: { option: EChartsOption; height?: number; label: string }) {
  return (
    <div role="img" aria-label={label} data-testid="chart">
      <EChartsReactCore echarts={echarts} option={{ ...baseOption, ...option }} style={{ height }} opts={{ renderer: "svg" }} notMerge lazyUpdate />
    </div>
  );
}
