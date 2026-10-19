import { useMemo, useState } from "react";
import { leverEffects, QUERY_METRICS, type QueryMetric } from "../../engine";
import { useAppStore, useAssumptions } from "../../store/useAppStore";
import { InputPanel } from "./InputPanel";
import { LeversPanel } from "./LeversPanel";
import { ReceiptCard, type ProviderLever } from "./ReceiptCard";
import { ScalePanel } from "./ScalePanel";
import { useEstimate } from "./useEstimate";

export default function ReceiptPage() {
  const set = useAssumptions();
  const { query, includeEmbodied, activeLevers } = useAppStore();
  const estimate = useEstimate(query, set, includeEmbodied, activeLevers);
  const [users, setUsers] = useState(100_000_000);
  const [perUser, setPerUser] = useState(1);

  const effects = useMemo(() => leverEffects(query, set, { includeEmbodied }, set.levers), [query, set, includeEmbodied]);

  // For each metric, the single provider-side lever with the largest reduction (spec §2 rule 3).
  const providerLever = useMemo(() => {
    const out = {} as Record<QueryMetric, ProviderLever>;
    for (const m of QUERY_METRICS) {
      let best: ProviderLever = null;
      for (const l of set.levers.filter((l) => l.actors.includes("provider"))) {
        const x = effects[l.id]?.[m] ?? 0;
        if (x < -0.005 && (!best || x < best.change)) best = { label: l.label, change: x };
      }
      out[m] = best;
    }
    return out;
  }, [effects, set.levers]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="space-y-5">
        <InputPanel />
        <ScalePanel estimate={estimate} users={users} perUser={perUser} onUsers={setUsers} onPerUser={setPerUser} />
        <LeversPanel effects={effects} />
      </div>
      <div className="lg:sticky lg:top-4 lg:self-start">
        <ReceiptCard estimate={estimate} queriesPerDay={users * perUser} providerLever={providerLever} />
      </div>
    </div>
  );
}
