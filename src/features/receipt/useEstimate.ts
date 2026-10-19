import { useDeferredValue, useMemo } from "react";
import { estimateQuery, type AssumptionSet, type ImpactEstimate, type QueryInput } from "../../engine";

/** Monte Carlo estimate; deferred so slider drags stay responsive. */
export function useEstimate(query: QueryInput, set: AssumptionSet, includeEmbodied: boolean, leverIds: string[]): ImpactEstimate {
  const deferred = useDeferredValue({ query, set, includeEmbodied, leverIds });
  return useMemo(() => {
    const levers = deferred.set.levers.filter((l) => deferred.leverIds.includes(l.id));
    return estimateQuery(deferred.query, deferred.set, { includeEmbodied: deferred.includeEmbodied, levers, mc: { n: 3000 } });
  }, [deferred]);
}
