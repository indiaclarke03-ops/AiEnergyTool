import { useState } from "react";
import { lineAssumptionIds, valuesAt, type ImpactEstimate, type LineMetric, type QueryMetric, type Range } from "../../engine";
import { BoundaryBadge } from "../../components/BoundaryBadge";
import { RangeValue } from "../../components/RangeValue";
import { SourceTooltip } from "../../components/SourceTooltip";
import { formatRange, pct, scaleRange, sig } from "../../components/format";
import { db, ensureSession } from "../../db/db";
import { useAppStore, useAssumptions } from "../../store/useAppStore";

type Line = {
  key: LineMetric;
  metric: QueryMetric;
  label: string;
  unit: string;
  annualUnit: string;
  value: Range;
  extra?: React.ReactNode;
};

export type ProviderLever = { label: string; change: number } | null;

export function ReceiptCard({
  estimate,
  queriesPerDay,
  providerLever,
}: {
  estimate: ImpactEstimate;
  queriesPerDay: number;
  providerLever: Record<QueryMetric, ProviderLever>;
}) {
  const set = useAssumptions();
  const { query, includeEmbodied, activeLevers, tokenSource, overrides, sessionId, setSessionId } = useAppStore();
  const [saved, setSaved] = useState<string | null>(null);
  const opts = { includeEmbodied };
  const v = valuesAt(set);
  const microwaveSeconds = (Wh: number) => (Wh * 3600) / v["compare.microwave_w"]!;
  const energyShare = estimate.energyCostUsd.central / estimate.fullCostUsd.central;

  const lines: Line[] = [
    {
      key: "energy",
      metric: "energyWh",
      label: "Energy",
      unit: "Wh",
      annualUnit: "Wh",
      value: estimate.energyWh,
      extra: <>≈ {sig(microwaveSeconds(estimate.energyWh.central), 2)} s of a {v["compare.microwave_w"]} W microwave</>,
    },
    { key: "carbon", metric: "carbonG", label: "Carbon", unit: "g", annualUnit: "g", value: estimate.carbonG, extra: <>g CO₂e</> },
    { key: "water", metric: "waterMl", label: "Water", unit: "mL", annualUnit: "mL", value: estimate.waterMl, extra: <>on-site cooling + off-site generation</> },
    { key: "energyCost", metric: "energyCostUsd", label: "Electricity cost", unit: "$", annualUnit: "$", value: estimate.energyCostUsd, extra: <>electricity only</> },
    {
      key: "fullCost",
      metric: "fullCostUsd",
      label: "Fully loaded cost",
      unit: "$",
      annualUnit: "$",
      value: estimate.fullCostUsd,
      extra: <>hardware + facility + energy · energy is <strong>{pct(energyShare)}</strong> of it</>,
    },
  ];

  async function save() {
    const session = sessionId !== null ? { id: sessionId } : await ensureSession();
    if (sessionId === null) setSessionId(session.id);
    await db.receipts.add({
      sessionId: session.id,
      createdAt: new Date().toISOString(),
      input: query,
      includeEmbodied,
      levers: activeLevers,
      tokenSource,
      estimate,
      assumptionVersions: set.versions,
      overrides,
    });
    setSaved(new Date().toLocaleTimeString());
  }

  return (
    <section aria-labelledby="receipt-heading" className="relative rounded-sm bg-white px-5 py-5 font-mono text-sm shadow-[0_1px_0_#e7e5e4,0_8px_24px_-12px_#00000040]" data-testid="receipt-card">
      <div className="text-center">
        <h2 id="receipt-heading" className="text-base font-bold tracking-widest">AI RECEIPT</h2>
        <p className="text-xs text-stone-500">
          {query.modelName || set.modelClasses.find((m) => m.key === query.modelClass)?.label} · {set.regions.find((r) => r.key === query.region)?.label}
        </p>
        <p className="text-xs text-stone-500">
          {query.inputTokens.toLocaleString()} in · {query.outputTokens.toLocaleString()} out
          {query.reasoning && ` · ${query.reasoningTokens !== undefined ? query.reasoningTokens.toLocaleString() : "est."} reasoning`}
          {tokenSource === "paste" && " · approx. count"}
        </p>
        {activeLevers.length > 0 && <p className="mt-1 text-xs text-cb-blue">with {activeLevers.length} lever{activeLevers.length > 1 && "s"} applied</p>}
      </div>

      <div className="my-3 border-t border-dashed border-stone-400" />

      <ul className="space-y-3">
        {lines.map((l) => (
          <li key={l.key} data-testid={`line-${l.key}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-sans text-xs font-semibold uppercase tracking-wide text-stone-600">{l.label}</span>
                <BoundaryBadge boundary={l.key === "energy" ? estimate.boundary : estimate.impactBoundary} />
              </div>
              <SourceTooltip assumptionIds={lineAssumptionIds(query, opts, l.key)} label={`Sources: ${l.label}`} />
            </div>
            <div className="mt-1 text-right">
              <RangeValue value={l.value} unit={l.unit} />
            </div>
            <div className="mt-0.5 font-sans text-[11px] text-stone-500">{l.extra}</div>
            <div className="mt-0.5 flex flex-wrap justify-between gap-x-3 font-sans text-[11px] text-stone-600">
              <span>
                At {sig(queriesPerDay, 2)} queries/day: <AnnualValue value={scaleRange(l.value, queriesPerDay * 365)} unit={l.annualUnit} />/yr
              </span>
              {providerLever[l.metric] && (
                <span>
                  Provider lever: {providerLever[l.metric]!.label} <strong>{pct(providerLever[l.metric]!.change)}</strong>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="my-3 border-t border-dashed border-stone-400" />
      <p className="font-sans text-[11px] leading-snug text-stone-500">
        Estimates, not measurements. Ranges are 5th–95th percentiles of a Monte Carlo run over sourced assumptions. Carbon, water and cost use
        facility-boundary energy{includeEmbodied ? " plus embodied (lifecycle) impacts" : ""}.
      </p>
      <div className="mt-3 flex items-center justify-between font-sans">
        <button type="button" onClick={save} className="rounded bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700">
          Save to session
        </button>
        {saved && <span className="text-xs text-[#006b4f]" role="status">Saved at {saved}</span>}
      </div>
    </section>
  );
}

function AnnualValue({ value, unit }: { value: Range; unit: string }) {
  const f = formatRange(value, unit);
  return (
    <span className="font-mono">
      {f.central}
      {f.unit && ` ${f.unit}`} <span className="text-stone-400">({f.band})</span>
    </span>
  );
}
