import { useMemo, useState } from "react";
import type { Assumption, Range } from "../../engine";
import { BoundaryBadge } from "../../components/BoundaryBadge";
import { UnverifiedFlag } from "../../components/UnverifiedFlag";
import { sig } from "../../components/format";
import { useAppStore, useAssumptions } from "../../store/useAppStore";

export default function AssumptionsPage() {
  const set = useAssumptions();
  const { overrides, resetAllOverrides } = useAppStore();
  const [q, setQ] = useState("");
  const [onlyUnverified, setOnlyUnverified] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return Object.values(set.assumptions).filter(
      (a) =>
        (!onlyUnverified || !a.verified) &&
        (!needle || [a.id, a.label, a.unit, a.notes ?? "", ...a.sources.map((s) => s.title)].join(" ").toLowerCase().includes(needle)),
    );
  }, [set, q, onlyUnverified]);

  const nOverrides = Object.keys(overrides).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Assumptions</h1>
          <p className="text-sm text-stone-600">
            Every number the engine uses. Edits are <strong>session overrides</strong>: they change all estimates in this tab and are recorded with
            saved receipts, but never alter the source files.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={onlyUnverified} onChange={(e) => setOnlyUnverified(e.target.checked)} /> Unverified only
          </label>
          <input
            type="search"
            aria-label="Search assumptions"
            placeholder="Search id, label, source…"
            className="w-64 rounded border border-stone-300 bg-white px-2 py-1.5"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {nOverrides > 0 && (
            <button className="rounded border border-stone-300 bg-white px-2 py-1.5 hover:bg-stone-100" onClick={resetAllOverrides}>
              Reset all ({nOverrides})
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-left text-sm" data-testid="assumptions-table">
          <thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-600">
            <tr>
              <th className="px-3 py-2">Assumption</th>
              <th className="px-3 py-2">Low</th>
              <th className="px-3 py-2">Central</th>
              <th className="px-3 py-2">High</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Boundary</th>
              <th className="px-3 py-2">Sources</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <Row key={a.id} a={a} overridden={a.id in overrides} />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-sm text-stone-500">No assumptions match.</p>}
      </div>
    </div>
  );
}

function Row({ a, overridden }: { a: Assumption; overridden: boolean }) {
  const { setOverride, resetOverride } = useAppStore();
  const [draft, setDraft] = useState<Record<keyof Range, string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const edit = (k: keyof Range, s: string) => {
    const next = { ...(draft ?? { low: String(a.value.low), central: String(a.value.central), high: String(a.value.high) }), [k]: s };
    setDraft(next);
    const r = { low: Number(next.low), central: Number(next.central), high: Number(next.high) };
    if ([r.low, r.central, r.high].some((x) => !Number.isFinite(x) || next[k] === "")) return setError("Enter numbers");
    if (!(r.low <= r.central && r.central <= r.high)) return setError("Need low ≤ central ≤ high");
    setError(null);
    setOverride(a.id, r);
  };

  return (
    <tr className={`border-t border-stone-100 align-top ${overridden ? "bg-[#fff7e6]" : ""}`}>
      <td className="px-3 py-2">
        <div className="font-medium">{a.label}</div>
        <div className="font-mono text-[11px] text-stone-500">{a.id}</div>
        {a.notes && <div className="mt-0.5 max-w-md text-xs text-stone-500">{a.notes}</div>}
      </td>
      {(["low", "central", "high"] as const).map((k) => (
        <td key={k} className="px-3 py-2">
          <input
            aria-label={`${a.label} ${k}`}
            className="w-24 rounded border border-stone-200 px-1.5 py-1 font-mono text-xs"
            value={draft?.[k] ?? sig(a.value[k], 4).replace(/,/g, "")}
            onChange={(e) => edit(k, e.target.value)}
            onBlur={() => !error && setDraft(null)}
          />
        </td>
      ))}
      <td className="px-3 py-2 text-xs">{a.unit}</td>
      <td className="px-3 py-2">{a.boundary && <BoundaryBadge boundary={a.boundary} />}</td>
      <td className="px-3 py-2 text-xs">
        <ul className="space-y-0.5">
          {a.sources.map((s) => (
            <li key={s.url + s.title}>
              <a className="underline hover:text-cb-blue" href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
            </li>
          ))}
        </ul>
      </td>
      <td className="px-3 py-2 text-xs">
        {a.verified ? <span className="text-[#006b4f]">✓ verified</span> : <span className="inline-flex items-center gap-1 text-[#a15c00]"><UnverifiedFlag /> unverified</span>}
        {overridden && (
          <div className="mt-1">
            <span className="font-medium text-[#8a5f00]">overridden</span>{" "}
            <button className="underline" onClick={() => { resetOverride(a.id); setDraft(null); setError(null); }}>reset</button>
          </div>
        )}
        {error && <div className="mt-1 text-cb-vermillion" role="alert">{error}</div>}
      </td>
    </tr>
  );
}
