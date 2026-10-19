import { useEffect } from "react";
import { db, ensureDisclosuresSeeded, type DisclosureRow } from "../../db/db";
import { useLiveQuery } from "../../db/useLiveQuery";

const COLS: { key: Exclude<keyof DisclosureRow, "id">; label: string; width: string }[] = [
  { key: "provider", label: "Provider", width: "w-28" },
  { key: "perQueryEnergy", label: "Per-query energy?", width: "w-48" },
  { key: "water", label: "Water?", width: "w-44" },
  { key: "methodology", label: "Methodology?", width: "w-44" },
  { key: "boundary", label: "Boundary", width: "w-52" },
  { key: "date", label: "Date", width: "w-20" },
  { key: "link", label: "Link", width: "w-56" },
  { key: "notes", label: "Notes", width: "w-56" },
];

const EMPTY: Omit<DisclosureRow, "id"> = {
  provider: "",
  perQueryEnergy: "not found",
  water: "not found",
  methodology: "not found",
  boundary: "not found",
  date: "",
  link: "",
  notes: "",
};

/** Editable table of what each provider discloses. Unknowns are "not found", never "none". */
export function Disclosures() {
  useEffect(() => {
    void ensureDisclosuresSeeded();
  }, []);
  const rows = useLiveQuery(() => db.disclosures.toArray(), [], [] as DisclosureRow[]);

  return (
    <section aria-labelledby="disc-heading" className="rounded-lg border border-stone-200 bg-white p-4" data-testid="disclosures">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="disc-heading" className="text-base font-semibold">
          Disclosure tracker
        </h2>
        <button className="rounded border border-stone-300 px-2 py-1 text-sm hover:bg-stone-100" onClick={() => db.disclosures.add({ ...EMPTY })}>
          Add provider
        </button>
      </div>
      <p className="mb-3 text-xs text-stone-500">
        What each provider publishes. <strong>“not found”</strong> means we have not found a disclosure — not that none exists. Seed rows are unverified;
        edits save automatically to this browser.
      </p>
      <div className="relative overflow-x-auto">
        <table className="text-left text-xs">
          <thead className="uppercase tracking-wide text-stone-500">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className="px-1 py-1">
                  {c.label}
                </th>
              ))}
              <th className="px-1 py-1">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-stone-100 align-top">
                {COLS.map((c) => (
                  <td key={c.key} className="px-1 py-1">
                    <textarea
                      aria-label={`${r.provider || "New provider"} — ${c.label}`}
                      rows={2}
                      className={`${c.width} resize-y rounded border border-transparent px-1 py-0.5 hover:border-stone-200 focus:border-stone-400 ${
                        r[c.key].startsWith("not found") ? "italic text-stone-500" : ""
                      }`}
                      defaultValue={r[c.key]}
                      onBlur={(e) => e.target.value !== r[c.key] && db.disclosures.update(r.id!, { [c.key]: e.target.value })}
                    />
                  </td>
                ))}
                <td className="px-1 py-1">
                  {r.link && (
                    <a className="block underline" href={r.link} target="_blank" rel="noreferrer">
                      open
                    </a>
                  )}
                  <button className="text-stone-500 underline" onClick={() => db.disclosures.delete(r.id!)}>
                    delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
