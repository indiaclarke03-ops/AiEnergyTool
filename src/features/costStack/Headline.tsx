import type { Distribution } from "../../engine";
import { pct } from "../../components/format";
import { SERIES } from "../../components/Chart";

/** Twin bars: energy share of cost vs energy share of externalities, each with its p5–p95 whisker. */
export function Headline({
  costShare,
  extShare,
  costShareCentral,
  extShareCentral,
}: {
  costShare: Distribution;
  extShare: Distribution;
  costShareCentral: number;
  extShareCentral: number;
}) {
  const rows = [
    { key: "cost", label: "Energy share of total cost", note: "electricity ÷ annual TCO", central: costShareCentral, d: costShare, color: SERIES.s1 },
    {
      key: "ext",
      label: "Energy share of external impact",
      note: "operational carbon + water ÷ all priced externalities (incl. embodied carbon)",
      central: extShareCentral,
      d: extShare,
      color: SERIES.s2,
    },
  ];
  return (
    <section aria-labelledby="headline-heading" className="rounded-lg border border-stone-200 bg-white p-4" data-testid="headline">
      <h2 id="headline-heading" className="text-sm font-semibold uppercase tracking-wide text-stone-500">The gap</h2>
      <p className="mb-3 text-sm text-stone-700">
        Energy is <strong>{pct(costShareCentral)}</strong> of what this facility costs its operator, but <strong>{pct(extShareCentral)}</strong> of the
        external costs it imposes.
      </p>
      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="font-mono">
                <strong>{pct(r.central)}</strong> <span className="text-xs text-stone-500">({pct(r.d.p5)}–{pct(r.d.p95)})</span>
              </span>
            </div>
            <div className="relative mt-1 h-6 rounded bg-stone-100" aria-hidden>
              <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${r.central * 100}%`, background: r.color }} />
              {/* p5–p95 whisker */}
              <div className="absolute top-1/2 h-px bg-stone-900" style={{ left: `${r.d.p5 * 100}%`, width: `${(r.d.p95 - r.d.p5) * 100}%` }} />
              <div className="absolute top-1 bottom-1 w-px bg-stone-900" style={{ left: `${r.d.p5 * 100}%` }} />
              <div className="absolute top-1 bottom-1 w-px bg-stone-900" style={{ left: `${r.d.p95 * 100}%` }} />
            </div>
            <div className="text-[11px] text-stone-500">{r.note}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-stone-500">Bars: central estimate. Whiskers: 5th–95th percentile (Monte Carlo). Externalities priced at the social cost of carbon and a water shadow price set in the sliders.</p>
    </section>
  );
}
