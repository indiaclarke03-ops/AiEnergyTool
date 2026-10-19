import { db } from "../../db/db";
import { download, flatten, stamp, toCsv } from "../../lib/export";
import { useAppStore, useAssumptions } from "../../store/useAppStore";

const btn = "rounded border border-stone-300 bg-white px-2.5 py-1 text-sm hover:bg-stone-100";

export function Exports() {
  const set = useAssumptions();
  const { overrides } = useAppStore();

  const receipts = async () => (await db.receipts.toArray()).map((r) => flatten(r as unknown as Record<string, unknown>));
  const scenarios = async () => (await db.scenarios.toArray()).map((s) => flatten(s as unknown as Record<string, unknown>));
  const assumptions = () =>
    Object.values(set.assumptions).map((a) => ({
      id: a.id,
      label: a.label,
      unit: a.unit,
      low: a.value.low,
      central: a.value.central,
      high: a.value.high,
      boundary: a.boundary ?? "",
      verified: a.verified,
      overridden: a.id in overrides,
      sources: a.sources.map((s) => `${s.title} <${s.url}>`).join(" | "),
      notes: a.notes ?? "",
    }));

  const snapshot = async () => ({
    kind: "ai-energy-lens/methodology-snapshot",
    generatedAt: new Date().toISOString(),
    assumptionFileVersions: set.versions,
    sessionOverrides: overrides,
    assumptions: set.assumptions,
    levers: set.levers,
    tcoPresets: set.tcoPresets,
    sessions: await db.sessions.toArray(),
    receipts: await db.receipts.toArray(),
    scenarios: await db.scenarios.toArray(),
    disclosures: await db.disclosures.toArray(),
    notes:
      "Ranges are p5/p95 of a triangular Monte Carlo; central uses central values. Every receipt stores the assumption versions and overrides used. See docs/METHODOLOGY.md.",
  });

  const csv = async (name: string, rows: Record<string, unknown>[] | Promise<Record<string, unknown>[]>) =>
    download(`${name}-${stamp()}.csv`, toCsv(await rows), "text/csv");
  const json = async (name: string, data: unknown) => download(`${name}-${stamp()}.json`, JSON.stringify(await data, null, 2), "application/json");

  return (
    <section aria-labelledby="exp-heading" className="rounded-lg border border-stone-200 bg-white p-4" data-testid="exports">
      <h2 id="exp-heading" className="text-base font-semibold">
        Export
      </h2>
      <p className="mb-3 text-xs text-stone-500">For reproducibility, every export can be paired with the exact assumption set it used.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Group title="Saved receipts">
          <button className={btn} onClick={() => csv("receipts", receipts())}>CSV</button>
          <button className={btn} onClick={() => json("receipts", db.receipts.toArray())}>JSON</button>
        </Group>
        <Group title="Scenarios">
          <button className={btn} onClick={() => csv("scenarios", scenarios())}>CSV</button>
          <button className={btn} onClick={() => json("scenarios", db.scenarios.toArray())}>JSON</button>
        </Group>
        <Group title="Assumption set in use">
          <button className={btn} onClick={() => csv("assumptions", assumptions())}>CSV</button>
          <button className={btn} onClick={() => json("assumptions", { versions: set.versions, overrides, assumptions: set.assumptions })}>JSON</button>
        </Group>
        <Group title="Methodology snapshot">
          <button className="rounded bg-stone-900 px-2.5 py-1 text-sm text-white hover:bg-stone-700" onClick={() => json("methodology-snapshot", snapshot())}>
            Download bundle
          </button>
        </Group>
      </div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-stone-100 p-2">
      <div className="mb-1.5 text-xs font-semibold text-stone-600">{title}</div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
