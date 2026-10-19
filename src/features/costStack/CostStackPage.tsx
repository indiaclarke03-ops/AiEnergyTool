import { useDeferredValue, useMemo } from "react";
import {
  costPerToken,
  facilityExternalities,
  moduleBAtPoint,
  presetOverrides,
  priceToCostRatio,
  runMonteCarlo,
  tcoFromValues,
  tcoParamsFromValues,
  valuesAt,
  type ModelClass,
} from "../../engine";
import { RangeValue } from "../../components/RangeValue";
import { SourceTooltip } from "../../components/SourceTooltip";
import { BoundaryBadge } from "../../components/BoundaryBadge";
import { useAppStore, useAssumptions } from "../../store/useAppStore";
import { CostMix, CostSankey, UtilizationCurve, Waterfall } from "./charts";
import { DrillToToken } from "./DrillToToken";
import { Headline } from "./Headline";
import { Sliders } from "./Sliders";

const TCO_IDS = (ids: string[]) => ids.filter((id) => id.startsWith("tco.") && !id.startsWith("tco.embodied"));

export default function CostStackPage() {
  const set = useAssumptions();
  const { query, setQuery, tcoRegion, setTcoRegion, apiPricePerMTok, setApiPrice, setOverrides, defaults } = useAppStore();
  const v = useMemo(() => valuesAt(set), [set]);
  const tco = useMemo(() => tcoFromValues(v), [v]);
  const params = useMemo(() => tcoParamsFromValues(v), [v]);
  const cpt = costPerToken(tco, query.modelClass, v);
  const ext = facilityExternalities(tco, tcoRegion, v);

  const deferred = useDeferredValue({ set, modelClass: query.modelClass, tcoRegion });
  const mc = useMemo(
    () => runMonteCarlo(deferred.set, (s) => moduleBAtPoint(s, deferred.modelClass, deferred.tcoRegion) as unknown as Record<string, number>, { n: 3000 }),
    [deferred],
  );
  const range = (k: string, central: number) => {
    const d = mc.metrics[k]!;
    return { low: Math.min(d.p5, central), central, high: Math.max(d.p95, central) };
  };

  const applyPreset = (id: string) => {
    const tcoIds = TCO_IDS(Object.keys(defaults.assumptions));
    const clear = Object.fromEntries(tcoIds.map((x) => [x, null]));
    setOverrides({ ...clear, ...presetOverrides(defaults, id) });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Cost Stack Explorer</h1>
          <p className="max-w-3xl text-sm text-stone-600">
            An AI data center's total cost of ownership, traced from the facility to the cost of a token. What share is energy, and which levers matter?
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Presets">
          <span className="text-xs text-stone-500">Presets:</span>
          {defaults.tcoPresets.map((p) => (
            <button key={p.id} onClick={() => applyPreset(p.id)} title={p.description} className="rounded border border-stone-300 bg-white px-2.5 py-1 hover:bg-stone-100">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
            <label className="mb-1 block text-xs font-medium text-stone-600" htmlFor="tco-region">Grid region (for externalities)</label>
            <select id="tco-region" className="w-full rounded border border-stone-300 px-2 py-1.5" value={tcoRegion} onChange={(e) => setTcoRegion(e.target.value)}>
              {set.regions.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <label className="mb-1 mt-2 block text-xs font-medium text-stone-600" htmlFor="tco-model">Model class (for cost per token)</label>
            <select id="tco-model" className="w-full rounded border border-stone-300 px-2 py-1.5" value={query.modelClass} onChange={(e) => setQuery({ modelClass: e.target.value as ModelClass })}>
              {set.modelClasses.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <Sliders />
        </aside>

        <div className="min-w-0 space-y-5">
          <Headline
            costShare={mc.metrics.energyShare!}
            extShare={mc.metrics.energyShareOfExternality!}
            costShareCentral={tco.energyShare}
            extShareCentral={ext.energyShareOfExternality}
          />

          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="kpis">
            <Kpi label="Annual TCO" ids={TCO_IDS(Object.keys(set.assumptions))}>
              <RangeValue value={range("annualTCO", tco.annualTCO)} unit="$" />
            </Kpi>
            <Kpi label="Cost per M tokens — full" ids={[`e_out.${query.modelClass}`, "server_overhead", "tco.utilization", "tco.capex.servers"]}>
              <RangeValue value={range("costPerMTokFull", cpt.costPerMTokFull)} unit="$" />
            </Kpi>
            <Kpi label="Cost per M tokens — energy only" ids={[`e_out.${query.modelClass}`, "server_overhead", "tco.pue", "tco.electricity_price"]}>
              <RangeValue value={range("costPerMTokEnergy", cpt.costPerMTokEnergy)} unit="$" />
            </Kpi>
            <div className="rounded-lg border border-stone-200 bg-white p-3">
              <dt className="text-xs text-stone-500">
                <label htmlFor="api-price">Public API price ($/M tokens, optional)</label>
              </dt>
              <dd>
                <input
                  id="api-price"
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1 w-full rounded border border-stone-300 px-2 py-1 font-mono text-sm"
                  value={apiPricePerMTok ?? ""}
                  placeholder="e.g. 10"
                  onChange={(e) => setApiPrice(e.target.value === "" ? null : Number(e.target.value))}
                />
                {apiPricePerMTok !== null && apiPricePerMTok > 0 && (
                  <p className="mt-1 text-xs" data-testid="price-ratio">
                    Price ÷ estimated cost = <strong className="font-mono">{priceToCostRatio(apiPricePerMTok, cpt).toFixed(1)}×</strong>{" "}
                    <span className="text-stone-500">
                      ({priceToCostRatio(apiPricePerMTok, cpt) >= 1 ? "implied margin" : "implied subsidy"}; output tokens only, central)
                    </span>
                  </p>
                )}
              </dd>
            </div>
          </dl>

          <Panel title="Capital vs operating cost">
            <CostMix tco={tco} />
            <p className="mt-2 text-xs text-stone-600">
              Energy is <strong>${(tco.annualEnergyCost / 1e6).toFixed(0)}M</strong> of <strong>${(tco.annualTCO / 1e9).toFixed(2)}B</strong> a year. The
              same facility emits <strong>{(ext.operationalCarbonT / 1e6).toFixed(2)} Mt CO₂e</strong> from electricity in this region, plus{" "}
              {(ext.embodiedCarbonT / 1e3).toFixed(0)} kt embodied (amortized).
            </p>
          </Panel>
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Annual TCO, built up" boundary>
              <Waterfall tco={tco} />
            </Panel>
            <Panel title="Why idle GPUs are expensive: $ per M tokens vs utilization">
              <UtilizationCurve params={params} v={v} modelClass={query.modelClass} />
              <p className="text-xs text-stone-600">Energy per token barely changes with utilization; hardware and facility costs are fixed, so idle capacity raises the full cost per token.</p>
            </Panel>
          </div>
          <Panel title="Where the money goes → cost per M tokens">
            <CostSankey tco={tco} costPerMTok={cpt.costPerMTokFull} />
          </Panel>

          <DrillToToken tco={tco} v={v} query={query} modelClassLabel={set.modelClasses.find((m) => m.key === query.modelClass)!.label} />
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, ids, children }: { label: string; ids: string[]; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <dt className="flex items-center justify-between text-xs text-stone-500">
        {label} <SourceTooltip assumptionIds={ids} label={`Sources: ${label}`} />
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function Panel({ title, children, boundary }: { title: string; children: React.ReactNode; boundary?: boolean }) {
  return (
    <section className="min-w-0 rounded-lg border border-stone-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {boundary && <BoundaryBadge boundary="facility" />}
      </div>
      {children}
    </section>
  );
}
