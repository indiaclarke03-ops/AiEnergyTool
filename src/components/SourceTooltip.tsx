import { useEffect, useId, useRef, useState } from "react";
import { useAssumptions } from "../store/useAppStore";
import { sig } from "./format";
import { UnverifiedFlag } from "./UnverifiedFlag";

/** "i" button that opens a panel listing every assumption (range, sources, verification) behind a number. */
export function SourceTooltip({ assumptionIds, label = "Sources" }: { assumptionIds: string[]; label?: string }) {
  const set = useAssumptions();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const items = [...new Set(assumptionIds)].map((id) => set.assumptions[id]).filter((a) => a !== undefined);
  const unverified = items.filter((a) => !a.verified).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center gap-1">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-stone-400 text-[11px] font-semibold text-stone-600 hover:bg-stone-100"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${label}: ${items.length} assumptions`}
        onClick={() => setOpen((o) => !o)}
      >
        i
      </button>
      <UnverifiedFlag count={unverified} />
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className="absolute right-0 top-6 z-30 max-h-96 w-[22rem] overflow-auto rounded-md border border-stone-300 bg-white p-3 text-left text-xs font-sans shadow-lg"
        >
          <p className="mb-2 font-semibold text-stone-700">{label}</p>
          <ul className="space-y-2">
            {items.map((a) => (
              <li key={a.id} className="border-t border-stone-100 pt-2 first:border-0 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{a.label}</span>
                  {a.verified ? (
                    <span className="text-[#006b4f]">✓ verified</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[#a15c00]">
                      <UnverifiedFlag /> unverified
                    </span>
                  )}
                </div>
                <div className="font-mono text-stone-600">
                  {sig(a.value.central)} {a.unit} <span className="text-stone-400">({sig(a.value.low)}–{sig(a.value.high)})</span>
                </div>
                <ul className="mt-0.5 list-disc pl-4 text-stone-600">
                  {a.sources.map((s) => (
                    <li key={s.url + s.title}>
                      <a className="underline hover:text-cb-blue" href={s.url} target="_blank" rel="noreferrer">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
                {a.notes && <p className="mt-0.5 text-stone-500">{a.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}
