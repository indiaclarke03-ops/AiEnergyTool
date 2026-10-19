import type { Actor, Lever, QueryMetric } from "../../engine";
import { leversByActor } from "../../engine";
import { pct } from "../../components/format";
import { useAppStore, useAssumptions } from "../../store/useAppStore";

const ACTORS: { key: Actor; title: string; blurb: string }[] = [
  { key: "provider", title: "Provider", blurb: "Serving, hardware and facility choices — the biggest levers." },
  { key: "policy", title: "Policy", blurb: "Siting, grid and disclosure rules." },
  { key: "user", title: "User", blurb: "Choices available when you use AI." },
];

const SHOWN: { key: QueryMetric; label: string }[] = [
  { key: "energyWh", label: "Energy" },
  { key: "carbonG", label: "Carbon" },
  { key: "waterMl", label: "Water" },
  { key: "fullCostUsd", label: "Full cost" },
];

export function LeversPanel({ effects }: { effects: Record<string, Record<QueryMetric, number>> }) {
  const set = useAssumptions();
  const { activeLevers, toggleLever } = useAppStore();
  const groups = leversByActor(set.levers);

  return (
    <section aria-labelledby="levers-heading" className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 id="levers-heading" className="text-sm font-semibold uppercase tracking-wide text-stone-500">What would change this?</h2>
      <p className="mb-3 text-xs text-stone-500">
        Tick levers to stack them; the receipt updates on every metric. Percentages show each lever alone (central estimate). Some levers mainly
        cut cost, others mainly cut carbon.
      </p>
      <div className="space-y-4">
        {ACTORS.map((a) => (
          <div key={a.key}>
            <h3 className="text-sm font-semibold">{a.title}</h3>
            <p className="mb-1 text-xs text-stone-500">{a.blurb}</p>
            <table className="w-full text-xs">
              <thead className="sr-only">
                <tr>
                  <th>Lever</th>
                  {SHOWN.map((m) => <th key={m.key}>{m.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {groups[a.key].map((l) => (
                  <LeverRow key={`${a.key}-${l.id}`} lever={l} active={activeLevers.includes(l.id)} onToggle={() => toggleLever(l.id)} effect={effects[l.id]} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}

function LeverRow({ lever, active, onToggle, effect }: { lever: Lever; active: boolean; onToggle: () => void; effect?: Record<QueryMetric, number> }) {
  return (
    <tr className="border-t border-stone-100 align-top">
      <td className="py-1.5 pr-2">
        <label className="inline-flex items-start gap-2">
          <input type="checkbox" className="mt-0.5" checked={active} onChange={onToggle} />
          <span>
            <span className="font-medium">{lever.label}</span>
            <span className="block text-stone-500">{lever.description}</span>
          </span>
        </label>
      </td>
      {SHOWN.map((m) => {
        const x = effect?.[m.key] ?? 0;
        const tone = x < -0.005 ? "text-[#006b4f]" : x > 0.005 ? "text-cb-vermillion" : "text-stone-400";
        return (
          <td key={m.key} className={`whitespace-nowrap py-1.5 pl-2 text-right font-mono ${tone}`}>
            <span className="block text-[10px] font-sans text-stone-400">{m.label}</span>
            {Math.abs(x) < 0.005 ? "±0%" : `${x < 0 ? "▼" : "▲"} ${pct(Math.abs(x))}`}
          </td>
        );
      })}
    </tr>
  );
}
