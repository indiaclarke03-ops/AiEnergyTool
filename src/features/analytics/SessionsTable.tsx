import { useMemo, useState } from "react";
import { db, newSession, type ReceiptRow, type SessionRow } from "../../db/db";
import { useLiveQuery } from "../../db/useLiveQuery";
import { RangeValue } from "../../components/RangeValue";
import { BoundaryBadge } from "../../components/BoundaryBadge";
import { useAppStore, useAssumptions } from "../../store/useAppStore";

export function SessionsTable() {
  const set = useAssumptions();
  const { sessionId, setSessionId } = useAppStore();
  const sessions = useLiveQuery(() => db.sessions.orderBy("createdAt").reverse().toArray(), [], [] as SessionRow[]);
  const receipts = useLiveQuery(() => db.receipts.orderBy("createdAt").reverse().toArray(), [], [] as ReceiptRow[]);
  const [f, setF] = useState({ session: "all", modelClass: "all", region: "all", reasoning: "all", boundary: "all" });

  const rows = useMemo(
    () =>
      receipts.filter(
        (r) =>
          (f.session === "all" || String(r.sessionId) === f.session) &&
          (f.modelClass === "all" || r.input.modelClass === f.modelClass) &&
          (f.region === "all" || r.input.region === f.region) &&
          (f.reasoning === "all" || String(r.input.reasoning) === f.reasoning) &&
          (f.boundary === "all" || r.input.boundary === f.boundary),
      ),
    [receipts, f],
  );

  const select = (key: keyof typeof f, label: string, options: [string, string][]) => (
    <label className="text-xs text-stone-600">
      {label}
      <select className="ml-1 rounded border border-stone-300 bg-white px-1.5 py-1 text-sm" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}>
        <option value="all">All</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section aria-labelledby="sessions-heading" className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="sessions-heading" className="text-base font-semibold">
          Saved receipts
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs text-stone-500">Current session: {sessions.find((s) => s.id === sessionId)?.name ?? "none yet"}</span>
          <button className="rounded border border-stone-300 px-2 py-1 hover:bg-stone-100" onClick={async () => setSessionId((await newSession()).id)}>
            New session
          </button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-3">
        {select("session", "Session", sessions.map((s) => [String(s.id), s.name]))}
        {select("modelClass", "Model", set.modelClasses.map((m) => [m.key, m.key]))}
        {select("region", "Region", set.regions.map((r) => [r.key, r.label]))}
        {select("reasoning", "Reasoning", [
          ["true", "on"],
          ["false", "off"],
        ])}
        {select("boundary", "Boundary", [
          ["gpu_only", "GPU only"],
          ["it_load", "IT load"],
          ["facility", "Facility"],
        ])}
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="sessions-table">
          <thead className="text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="py-1 pr-3">When</th>
              <th className="py-1 pr-3">Model</th>
              <th className="py-1 pr-3">Tokens in/out</th>
              <th className="py-1 pr-3">Region</th>
              <th className="py-1 pr-3">Energy</th>
              <th className="py-1 pr-3">Carbon</th>
              <th className="py-1 pr-3">Water</th>
              <th className="py-1 pr-3">Full cost</th>
              <th className="py-1">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-stone-100 align-top">
                <td className="py-1.5 pr-3 text-xs">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="py-1.5 pr-3 text-xs">
                  {r.input.modelName || r.input.modelClass}
                  {r.input.reasoning && <span className="ml-1 rounded bg-stone-100 px-1">reasoning</span>}
                  {r.levers.length > 0 && <span className="ml-1 rounded bg-stone-100 px-1">{r.levers.length} levers</span>}
                </td>
                <td className="py-1.5 pr-3 font-mono text-xs">
                  {r.input.inputTokens}/{r.input.outputTokens}
                  {r.tokenSource === "paste" && "≈"}
                </td>
                <td className="py-1.5 pr-3 text-xs">{r.input.region}</td>
                <td className="py-1.5 pr-3">
                  <RangeValue value={r.estimate.energyWh} unit="Wh" size="sm" /> <BoundaryBadge boundary={r.estimate.boundary} />
                </td>
                <td className="py-1.5 pr-3">
                  <RangeValue value={r.estimate.carbonG} unit="g" size="sm" />
                </td>
                <td className="py-1.5 pr-3">
                  <RangeValue value={r.estimate.waterMl} unit="mL" size="sm" />
                </td>
                <td className="py-1.5 pr-3">
                  <RangeValue value={r.estimate.fullCostUsd} unit="$" size="sm" />
                </td>
                <td className="py-1.5">
                  <button className="text-xs text-stone-500 underline" onClick={() => db.receipts.delete(r.id!)} aria-label="Delete receipt">
                    delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="py-4 text-sm text-stone-500">
            No saved receipts{receipts.length ? " match these filters" : " yet — use “Save to session” on the AI Receipt page"}.
          </p>
        )}
      </div>
    </section>
  );
}
