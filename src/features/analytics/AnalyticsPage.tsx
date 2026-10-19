import { Comparisons } from "./Comparisons";
import { Disclosures } from "./Disclosures";
import { Exports } from "./Exports";
import { Scenarios } from "./Scenarios";
import { SessionsTable } from "./SessionsTable";
import { Uncertainty } from "./Uncertainty";

export default function AnalyticsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Research Dashboard</h1>
        <p className="max-w-3xl text-sm text-stone-600">
          Saved receipts and scenarios, comparisons across models and regions, sensitivity and uncertainty analysis, provider disclosures, and exports.
          All data stays in this browser.
        </p>
      </div>
      <SessionsTable />
      <Comparisons />
      <Uncertainty />
      <Scenarios />
      <Disclosures />
      <Exports />
    </div>
  );
}
