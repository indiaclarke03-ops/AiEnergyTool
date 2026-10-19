import { useMemo, useState } from "react";
import { moduleBAtPoint, runMonteCarlo, valuesAt, withOverrides, type Range } from "../../engine";
import { db, type ScenarioRow } from "../../db/db";
import { useLiveQuery } from "../../db/useLiveQuery";
import { RangeValue } from "../../components/RangeValue";
import { useAppStore } from "../../store/useAppStore";

const MAX_COMPARE = 4;

const ROWS: { key: keyof ReturnType<typeof moduleBAtPoint>; label: string; unit: string }[] = [
  { key: "annualTCO", label: "Annual TCO", unit: "$" },
  { key: "energyShare", label: "Energy share of cost", unit: "%" },
  { key: "costPerMTokFull", label: "$ / M tokens (full)", unit: "$" },
  { key: "costPerMTokEnergy", label: "$ / M tokens (energy)", unit: "$" },
  { key: "energyShareOfExternality", label: "Energy share of externalities", unit: "%" },
  { key: "operationalCarbonT", label: "Operational carbon / yr", unit: "g" },
];

/** Only Module B assumptions belong to a scenario. */
const isModuleB = (id: string) => id.startsWith("tco.") || id.startsWith("ext.");

export function Scenarios() {
  const { defaults, overrides, query, tcoRegion, setOverrides, setTcoRegion, setQuery, setPage } = useAppStore();
  const scenarios = useLiveQuery(() => db.scenarios.orderBy("createdAt").toArray(), [], [] as ScenarioRow[]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  const save = async () => {
    const own = Object.fromEntries(Object.entries(overrides).filter(([id]) => isModuleB(id)));
    await db.scenarios.add({
      name: name.trim() || `Scenario ${scenarios.length + 1}`,
      createdAt: new Date().toISOString(),
      overrides: own,
      region: tcoRegion,
      modelClass: query.modelClass,
    });
    setName("");
  };

  const load = (s: ScenarioRow) => {
    const clear = Object.fromEntries(Object.keys(defaults.assumptions).filter(isModuleB).map((id) => [id, null]));
    setOverrides({ ...clear, ...s.overrides });
    setTcoRegion(s.region);
    setQuery({ modelClass: s.modelClass });
    setPage("costStack");
  };

  const toggle = (id: number) =>
    setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < MAX_COMPARE ? [...sel, id] : sel));

  const compared = scenarios.filter((s) => selected.includes(s.id!));

  return (
    <section aria-labelledby="scen-heading" className="rounded-lg border border-stone-200 bg-white p-4" data-testid="scenarios">
      <h2 id="scen-heading" className="text-base font-semibold">
        Scenarios
      </h2>
      <p className="mb-3 text-xs text-stone-500">
        Save the current Cost Stack configuration (its slider overrides, region and model class), then tick up to {MAX_COMPARE} to compare side by side.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          aria-label="Scenario name"
          className="w-64 rounded border border-stone-300 px-2 py-1 text-sm"
          placeholder="Name this scenario"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="rounded bg-stone-900 px-3 py-1 text-sm text-white hover:bg-stone-700" onClick={save}>
          Save current Cost Stack
        </button>
      </div>
      {scenarios.length > 0 && (
        <ul className="mb-3 space-y-1 text-sm">
          {scenarios.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={selected.includes(s.id!)} onChange={() => toggle(s.id!)} disabled={!selected.includes(s.id!) && selected.length >= MAX_COMPARE} />
                <span className="font-medium">{s.name}</span>
              </label>
              <span className="text-xs text-stone-500">
                {Object.keys(s.overrides).length} changes · {s.region} · {s.modelClass}
              </span>
              <button className="text-xs underline" onClick={() => load(s)}>
                load
              </button>
              <button className="text-xs text-stone-500 underline" onClick={() => db.scenarios.delete(s.id!)}>
                delete
              </button>
            </li>
          ))}
        </ul>
      )}
      {compared.length > 0 && <CompareTable scenarios={compared} />}
    </section>
  );
}

function CompareTable({ scenarios }: { scenarios: ScenarioRow[] }) {
  const defaults = useAppStore((s) => s.defaults);
  const results = useMemo(
    () =>
      scenarios.map((s) => {
        const set = withOverrides(defaults, s.overrides);
        const central = moduleBAtPoint(valuesAt(set), s.modelClass, s.region);
        const mc = runMonteCarlo(set, (v) => moduleBAtPoint(v, s.modelClass, s.region) as unknown as Record<string, number>, { n: 1000 });
        return { s, central, mc };
      }),
    [scenarios, defaults],
  );
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-left text-sm" data-testid="scenario-compare">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-stone-500">
            <th className="py-1 pr-3">Metric</th>
            {results.map((r) => (
              <th key={r.s.id} className="py-1 pr-3">
                {r.s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.key} className="border-t border-stone-100">
              <td className="py-1.5 pr-3 text-xs text-stone-600">{row.label}</td>
              {results.map((r) => {
                const d = r.mc.metrics[row.key]!;
                const c = r.central[row.key];
                const range: Range = { low: Math.min(d.p5, c), central: c, high: Math.max(d.p95, c) };
                return (
                  <td key={r.s.id} className="py-1.5 pr-3">
                    {row.unit === "%" ? (
                      <span className="font-mono text-sm">
                        <strong>{(c * 100).toFixed(1)}%</strong>{" "}
                        <span className="text-xs text-stone-500">
                          ({(range.low * 100).toFixed(1)}–{(range.high * 100).toFixed(1)})
                        </span>
                      </span>
                    ) : (
                      <RangeValue value={row.unit === "g" ? { low: range.low * 1e6, central: c * 1e6, high: range.high * 1e6 } : range} unit={row.unit} size="sm" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
