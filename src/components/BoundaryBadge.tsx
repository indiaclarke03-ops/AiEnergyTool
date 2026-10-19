import type { Boundary } from "../engine";

const META: Record<Boundary, { label: string; glyph: string; cls: string; title: string }> = {
  gpu_only: { label: "GPU only", glyph: "◆", cls: "border-cb-blue text-cb-blue", title: "Counts accelerator (GPU) power only" },
  it_load: { label: "IT load", glyph: "■", cls: "border-cb-orange text-[#8a5f00]", title: "GPU + CPU, memory, networking and idle reserve" },
  facility: { label: "Facility (incl. cooling/PUE)", glyph: "▲", cls: "border-cb-green text-[#006b4f]", title: "IT load × PUE: adds cooling and power delivery" },
  lifecycle: { label: "Lifecycle (incl. embodied)", glyph: "●", cls: "border-cb-purple text-[#9c4a7a]", title: "Facility + embodied impacts of hardware manufacturing" },
};

export const boundaryLabel = (b: Boundary) => META[b].label;

/** Boundary label: colour + glyph + text, so meaning never relies on colour alone. */
export function BoundaryBadge({ boundary }: { boundary: Boundary }) {
  const m = META[boundary];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded border bg-white px-1.5 py-0.5 text-[11px] font-medium ${m.cls}`}
      title={m.title}
      data-testid={`boundary-${boundary}`}
    >
      <span aria-hidden>{m.glyph}</span>
      {m.label}
    </span>
  );
}
