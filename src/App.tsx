import { useEffect, useState } from "react";
import AnalyticsPage from "./features/analytics/AnalyticsPage";
import AssumptionsPage from "./features/assumptions/AssumptionsPage";
import CostStackPage from "./features/costStack/CostStackPage";
import ReceiptPage from "./features/receipt/ReceiptPage";
import { UnverifiedFlag } from "./components/UnverifiedFlag";
import { useAppStore, useAssumptions, type Page } from "./store/useAppStore";

const PAGES: { key: Page; label: string }[] = [
  { key: "receipt", label: "AI Receipt" },
  { key: "costStack", label: "Cost Stack" },
  { key: "analytics", label: "Research Dashboard" },
  { key: "assumptions", label: "Assumptions" },
];

export default function App() {
  const { page, setPage } = useAppStore();
  const set = useAssumptions();
  const unverified = Object.values(set.assumptions).filter((a) => !a.verified).length;
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace("#/", "") as Page;
      if (PAGES.some((p) => p.key === h)) useAppStore.setState({ page: h });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div>
            <div className="font-semibold">AI Energy &amp; Cost Lens</div>
            <div className="text-xs text-stone-500">Ethical Tech CoLab · research prototype · estimates, not measurements</div>
          </div>
          <nav aria-label="Pages" className="flex flex-wrap gap-1 text-sm">
            {PAGES.map((p) => (
              <a
                key={p.key}
                href={`#/${p.key}`}
                aria-current={page === p.key ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setPage(p.key);
                }}
                className={`rounded px-3 py-1.5 ${page === p.key ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"}`}
              >
                {p.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <button
              onClick={() => setPage("assumptions")}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e69f00] bg-[#fff7e6] px-3 py-1 text-xs font-medium text-[#8a5f00]"
              data-testid="unverified-badge"
            >
              <UnverifiedFlag /> {unverified} unverified assumptions
            </button>
            <button onClick={() => setAboutOpen((o) => !o)} aria-expanded={aboutOpen} className="text-xs underline">
              About &amp; limitations
            </button>
          </div>
        </div>
        {aboutOpen && <About />}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {page === "receipt" && <ReceiptPage />}
        {page === "costStack" && <CostStackPage />}
        {page === "analytics" && <AnalyticsPage />}
        {page === "assumptions" && <AssumptionsPage />}
      </main>
    </div>
  );
}

function About() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-4 text-sm text-stone-700">
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <p className="mb-2">
          This tool <strong>estimates</strong> the energy, carbon, water and cost of AI use from public sources. Every figure shows a range and the
          boundary it counts. See <code>docs/METHODOLOGY.md</code> for formulas.
        </p>
        <h2 className="font-semibold">Known limitations</h2>
        <ul className="list-disc pl-5">
          <li>Proprietary model sizes and serving setups are unknown, so the model-class approach is a deliberate simplification.</li>
          <li>Token counts for non-OpenAI models are approximate unless metered chat mode is used.</li>
          <li>TCO defaults describe one reference facility. Real providers differ in utilization, hardware mix and contracts.</li>
          <li>Per-query numbers are small, so the aggregate and provider-lever views are essential to avoid misleading conclusions.</li>
          <li>All defaults are unverified until checked by the research team.</li>
        </ul>
      </div>
    </div>
  );
}
