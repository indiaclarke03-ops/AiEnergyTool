import { useEffect, useState } from "react";
import type { ModelClass, QueryBoundary } from "../../engine";
import { useAppStore, useAssumptions } from "../../store/useAppStore";
import { MeteredChat } from "./MeteredChat";
import { countTokens } from "./tokenize";

const field = "w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm";
const label = "block text-xs font-medium text-stone-600 mb-1";

export function InputPanel() {
  const set = useAssumptions();
  const { query, setQuery, includeEmbodied, setIncludeEmbodied, tokenSource, setTokenSource } = useAppStore();

  return (
    <section aria-labelledby="input-heading" className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 id="input-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
        Query
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="model-class">Model class</label>
          <select id="model-class" className={field} value={query.modelClass} onChange={(e) => setQuery({ modelClass: e.target.value as ModelClass })}>
            {set.modelClasses.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="model-name">Model name (optional, for logging)</label>
          <input id="model-name" className={field} value={query.modelName ?? ""} placeholder="e.g. gpt-4o" onChange={(e) => setQuery({ modelName: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="region">Grid region</label>
          <select id="region" className={field} value={query.region} onChange={(e) => setQuery({ region: e.target.value })}>
            {set.regions.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="boundary">Energy boundary</label>
          <select id="boundary" className={field} value={query.boundary} onChange={(e) => setQuery({ boundary: e.target.value as QueryBoundary })}>
            <option value="gpu_only">GPU only</option>
            <option value="it_load">IT load (server)</option>
            <option value="facility">Facility (incl. cooling/PUE)</option>
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={query.reasoning} onChange={(e) => setQuery({ reasoning: e.target.checked })} />
          Reasoning / thinking mode
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={includeEmbodied} onChange={(e) => setIncludeEmbodied(e.target.checked)} />
          Include embodied / lifecycle
        </label>
      </div>

      <div role="tablist" aria-label="Token entry mode" className="mt-4 flex gap-1 border-b border-stone-200 text-sm">
        {(
          [
            ["manual", "Manual"],
            ["paste", "Paste conversation"],
            ["metered", "Metered chat"],
          ] as const
        ).map(([key, text]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tokenSource === key}
            className={`-mb-px rounded-t border px-3 py-1.5 ${tokenSource === key ? "border-stone-200 border-b-white bg-white font-medium" : "border-transparent text-stone-500 hover:text-stone-800"}`}
            onClick={() => setTokenSource(key)}
          >
            {text}
          </button>
        ))}
      </div>
      <div className="pt-3">
        {tokenSource === "manual" && <ManualTokens />}
        {tokenSource === "paste" && <PasteTokens />}
        {tokenSource === "metered" && <MeteredChat />}
      </div>
    </section>
  );
}

function NumberField({ id, text, value, onChange, hint }: { id: string; text: string; value: number | undefined; onChange: (n: number | undefined) => void; hint?: string }) {
  return (
    <div>
      <label className={label} htmlFor={id}>{text}</label>
      <input
        id={id}
        type="number"
        min={0}
        step={1}
        className={`${field} font-mono`}
        value={value ?? ""}
        placeholder={hint}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value))))}
      />
    </div>
  );
}

function ManualTokens() {
  const { query, setQuery } = useAppStore();
  return (
    <div className="grid grid-cols-3 gap-3">
      <NumberField id="input-tokens" text="Input tokens" value={query.inputTokens} onChange={(n) => setQuery({ inputTokens: n ?? 0 })} />
      <NumberField id="output-tokens" text="Output tokens (visible)" value={query.outputTokens} onChange={(n) => setQuery({ outputTokens: n ?? 0 })} />
      {query.reasoning && (
        <NumberField id="reasoning-tokens" text="Reasoning tokens (if known)" value={query.reasoningTokens} hint="estimated" onChange={(n) => setQuery({ reasoningTokens: n })} />
      )}
    </div>
  );
}

function PasteTokens() {
  const setQuery = useAppStore((s) => s.setQuery);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [counts, setCounts] = useState<{ input: number; output: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const [input, output] = await Promise.all([countTokens(prompt), countTokens(response)]);
      if (cancelled) return;
      setCounts({ input, output });
      setQuery({ inputTokens: input, outputTokens: output });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [prompt, response, setQuery]);

  return (
    <div className="space-y-2">
      <div>
        <label className={label} htmlFor="paste-prompt">Prompt (and any prior context)</label>
        <textarea id="paste-prompt" rows={3} className={field} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </div>
      <div>
        <label className={label} htmlFor="paste-response">Response</label>
        <textarea id="paste-response" rows={4} className={field} value={response} onChange={(e) => setResponse(e.target.value)} />
      </div>
      <p className="text-xs text-stone-500" data-testid="paste-counts">
        {counts ? `${counts.input.toLocaleString()} input · ${counts.output.toLocaleString()} output tokens` : "Counting…"} — counted with
        the o200k tokenizer; <strong>approximate for non-OpenAI models</strong>. Hidden reasoning tokens are not visible in pasted text and
        are estimated when reasoning mode is on.
      </p>
    </div>
  );
}
