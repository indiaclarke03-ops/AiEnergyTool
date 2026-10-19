import { useMemo } from "react";
import { create } from "zustand";
import { loadDefaultAssumptions, withOverrides, type AssumptionSet, type QueryInput, type Range } from "../engine";

export type Page = "receipt" | "costStack" | "analytics" | "assumptions";

const defaults = loadDefaultAssumptions();

type State = {
  page: Page;
  defaults: AssumptionSet;
  overrides: Record<string, Range>;
  query: QueryInput;
  includeEmbodied: boolean;
  activeLevers: string[];
  tokenSource: "manual" | "paste" | "metered";
  sessionId: number | null;
  /** Module B: grid region used for the facility's externalities. */
  tcoRegion: string;
  /** Module B: optional public API price, $ per million tokens. */
  apiPricePerMTok: number | null;

  setPage: (p: Page) => void;
  setQuery: (patch: Partial<QueryInput>) => void;
  setIncludeEmbodied: (b: boolean) => void;
  toggleLever: (id: string) => void;
  setTokenSource: (s: State["tokenSource"]) => void;
  setOverride: (id: string, value: Range) => void;
  resetOverride: (id: string) => void;
  resetAllOverrides: () => void;
  setSessionId: (id: number) => void;
  setOverrides: (patch: Record<string, Range | null>) => void;
  setTcoRegion: (r: string) => void;
  setApiPrice: (p: number | null) => void;
};

const pageFromHash = (): Page => {
  const h = typeof location === "undefined" ? "" : location.hash.replace("#/", "");
  return (["receipt", "costStack", "analytics", "assumptions"] as const).find((p) => p === h) ?? "receipt";
};

export const useAppStore = create<State>((set) => ({
  page: pageFromHash(),
  defaults,
  overrides: {},
  query: {
    modelClass: "frontier",
    modelName: "",
    inputTokens: 100,
    outputTokens: 500,
    reasoning: false,
    region: "us-east",
    boundary: "facility",
    modality: "text",
  },
  includeEmbodied: false,
  activeLevers: [],
  tokenSource: "manual",
  sessionId: null,
  tcoRegion: "us-east",
  apiPricePerMTok: null,

  setPage: (page) => {
    if (typeof location !== "undefined") location.hash = `/${page}`;
    set({ page });
  },
  setQuery: (patch) => set((s) => ({ query: { ...s.query, ...patch } })),
  setIncludeEmbodied: (includeEmbodied) => set({ includeEmbodied }),
  toggleLever: (id) =>
    set((s) => ({ activeLevers: s.activeLevers.includes(id) ? s.activeLevers.filter((x) => x !== id) : [...s.activeLevers, id] })),
  setTokenSource: (tokenSource) => set({ tokenSource }),
  setOverride: (id, value) => set((s) => ({ overrides: { ...s.overrides, [id]: value } })),
  resetOverride: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.overrides;
      return { overrides: rest };
    }),
  resetAllOverrides: () => set({ overrides: {} }),
  setSessionId: (sessionId) => set({ sessionId }),
  setOverrides: (patch) =>
    set((s) => {
      const next = { ...s.overrides };
      for (const [id, r] of Object.entries(patch)) {
        if (r === null) delete next[id];
        else next[id] = r;
      }
      return { overrides: next };
    }),
  setTcoRegion: (tcoRegion) => set({ tcoRegion }),
  setApiPrice: (apiPricePerMTok) => set({ apiPricePerMTok }),
}));

/** The assumption set in effect: defaults plus session overrides. */
export function useAssumptions(): AssumptionSet {
  const d = useAppStore((s) => s.defaults);
  const o = useAppStore((s) => s.overrides);
  return useMemo(() => (Object.keys(o).length ? withOverrides(d, o) : d), [d, o]);
}
