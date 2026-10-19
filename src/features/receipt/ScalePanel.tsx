import { valuesAt, type ImpactEstimate } from "../../engine";
import { RangeValue } from "../../components/RangeValue";
import { BoundaryBadge } from "../../components/BoundaryBadge";
import { scaleRange, sig } from "../../components/format";
import { useAssumptions } from "../../store/useAppStore";

/** Log-scale slider helpers: position 0..90 ↔ 10^0..10^9. */
const toLog = (n: number) => Math.round(Math.log10(Math.max(1, n)) * 10);
const fromLog = (p: number) => Math.round(Math.pow(10, p / 10));

export function ScalePanel({
  estimate,
  users,
  perUser,
  onUsers,
  onPerUser,
}: {
  estimate: ImpactEstimate;
  users: number;
  perUser: number;
  onUsers: (n: number) => void;
  onPerUser: (n: number) => void;
}) {
  const v = valuesAt(useAssumptions());
  const perDay = users * perUser;
  const perYear = perDay * 365;
  const energyYr = scaleRange(estimate.energyWh, perYear);
  const homes = energyYr.central / 1000 / v["compare.us_home_kwh_yr"]!;

  return (
    <section aria-labelledby="scale-heading" className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 id="scale-heading" className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">At scale</h2>
      <p className="mb-3 text-xs text-stone-500">Per-query numbers are tiny; what matters is the aggregate. Adjust how many people do this, how often.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="users" className="flex justify-between text-xs font-medium text-stone-600">
            <span>People</span>
            <span className="font-mono">{sig(users, 2)}</span>
          </label>
          <input id="users" type="range" min={0} max={90} value={toLog(users)} onChange={(e) => onUsers(fromLog(Number(e.target.value)))} className="w-full" aria-valuetext={`${users.toLocaleString()} people`} />
        </div>
        <div>
          <label htmlFor="per-user" className="flex justify-between text-xs font-medium text-stone-600">
            <span>Queries per person per day</span>
            <span className="font-mono">{perUser}</span>
          </label>
          <input id="per-user" type="range" min={1} max={100} value={perUser} onChange={(e) => onPerUser(Number(e.target.value))} className="w-full" />
        </div>
      </div>
      <p className="mt-2 text-xs text-stone-600">
        = <span className="font-mono">{perDay.toLocaleString()}</span> queries/day
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="scale-results">
        <div>
          <dt className="text-xs text-stone-500">Energy / yr <BoundaryBadge boundary={estimate.boundary} /></dt>
          <dd><RangeValue value={energyYr} unit="Wh" size="sm" /></dd>
          <dd className="text-[11px] text-stone-500">≈ {sig(homes, 2)} US homes' annual electricity</dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">Carbon / yr <BoundaryBadge boundary={estimate.impactBoundary} /></dt>
          <dd><RangeValue value={scaleRange(estimate.carbonG, perYear)} unit="g" size="sm" /></dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">Full cost / yr</dt>
          <dd><RangeValue value={scaleRange(estimate.fullCostUsd, perYear)} unit="$" size="sm" /></dd>
        </div>
      </dl>
    </section>
  );
}
