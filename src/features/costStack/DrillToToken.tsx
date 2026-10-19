import { costPerToken, queryEnergy, type ModelClass, type QueryInput, type TcoResult, type Values } from "../../engine";
import { sig } from "../../components/format";
import { BoundaryBadge } from "../../components/BoundaryBadge";

/** The chain facility → year → kWh → tokens → one query, using the current Module A query. */
export function DrillToToken({ tco, v, query, modelClassLabel }: { tco: TcoResult; v: Values; query: QueryInput; modelClassLabel: string }) {
  const c = costPerToken(tco, query.modelClass as ModelClass, v);
  const q = queryEnergy(query, v);
  const queryCost = (q.tokenEquivalents * c.costPerMTokFull) / 1e6;
  const steps: [string, string, string][] = [
    ["Facility", `${sig(v["tco.capacity_mw"]!)} MW IT capacity`, `at ${Math.round(v["tco.utilization"]! * 100)}% utilization`],
    ["One year", `$${sig(tco.annualTCO / 1e9)}B total cost`, `of which energy $${sig(tco.annualEnergyCost / 1e6)}M`],
    ["Energy", `${sig(tco.annualEnergyKWh / 1e9)} TWh facility`, `${sig(tco.annualITKWh / 1e9)} TWh at the servers (IT)`],
    ["Tokens", `${sig(c.tokensPerYear / 1e12)} trillion tokens/yr`, `${modelClassLabel} at ${sig(c.facilityWhPerToken * 1000)} mWh/token (facility)`],
    ["Per M tokens", `$${sig(c.costPerMTokFull)} full`, `$${sig(c.costPerMTokEnergy)} energy only`],
    ["Your query", `$${sig(queryCost)}`, `${sig(q.tokenEquivalents)} output-token-equivalents (from the Receipt)`],
  ];
  return (
    <section aria-labelledby="drill-heading" className="rounded-lg border border-stone-200 bg-white p-4" data-testid="drill">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="drill-heading" className="text-sm font-semibold uppercase tracking-wide text-stone-500">Drill to a token</h2>
        <BoundaryBadge boundary="facility" />
      </div>
      <ol className="space-y-1.5">
        {steps.map(([k, main, sub], i) => (
          <li key={k} className="grid grid-cols-[6.5rem_1fr] items-baseline gap-2 text-sm">
            <span className="text-xs font-medium text-stone-500">{i > 0 && "↓ "}{k}</span>
            <span>
              <span className="font-mono font-semibold">{main}</span> <span className="text-xs text-stone-500">{sub}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-stone-500">Central values. Change the query on the Receipt page; change the facility with the sliders.</p>
    </section>
  );
}
