import { useEffect, useState } from "react";
import { useAppStore } from "../../store/useAppStore";

type Provider = "anthropic" | "openai";
type Providers = Record<Provider, { configured: boolean; defaultModel: string; baseUrl?: string }>;
type Usage = { inputTokens: number; outputTokens: number; reasoningTokens?: number };
type Turn = { role: "user" | "assistant"; content: string; usage?: Usage; model?: string; note?: string };

const field = "w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm";

/** Chat through the local proxy (server/index.ts); the receipt uses the exact `usage` the provider returns. */
export function MeteredChat() {
  const { setQuery, setTokenSource } = useAppStore();
  const [providers, setProviders] = useState<Providers | null>(null);
  const [proxyError, setProxyError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [model, setModel] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((p: Providers) => {
        setProviders(p);
        const first = (["anthropic", "openai"] as const).find((k) => p[k].configured) ?? "anthropic";
        setProvider(first);
        setModel(p[first].defaultModel);
      })
      .catch(() => setProxyError("The metered-chat proxy is not running. Start it with `npm run server` (API keys go in .env)."));
  }, []);

  async function send() {
    const content = draft.trim();
    if (!content || busy) return;
    const history = [...turns, { role: "user" as const, content }];
    setTurns(history);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, model: model || undefined, messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      const usage: Usage = data.usage;
      setTurns([...history, { role: "assistant", content: data.text, usage, model: data.model, note: data.note }]);
      // The receipt reflects this API call: every turn re-sends the conversation, so input grows each turn.
      setQuery({
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        reasoning: (usage.reasoningTokens ?? 0) > 0,
        reasoningTokens: usage.reasoningTokens,
        modelName: data.model,
      });
      setTokenSource("metered");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTurns(turns);
      setDraft(content);
    } finally {
      setBusy(false);
    }
  }

  if (proxyError) return <p className="text-sm text-stone-600" role="status">{proxyError}</p>;
  if (!providers) return <p className="text-sm text-stone-500">Connecting to proxy…</p>;

  const totals = turns.reduce(
    (t, x) => (x.usage ? { calls: t.calls + 1, input: t.input + x.usage.inputTokens, output: t.output + x.usage.outputTokens + (x.usage.reasoningTokens ?? 0) } : t),
    { calls: 0, input: 0, output: 0 },
  );

  return (
    <div className="space-y-2" data-testid="metered-chat">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600" htmlFor="mc-provider">Provider</label>
          <select
            id="mc-provider"
            className={field}
            value={provider}
            onChange={(e) => {
              const p = e.target.value as Provider;
              setProvider(p);
              setModel(providers[p].defaultModel);
            }}
          >
            <option value="anthropic" disabled={!providers.anthropic.configured}>Anthropic{providers.anthropic.configured ? "" : " (no key)"}</option>
            <option value="openai" disabled={!providers.openai.configured}>OpenAI-compatible{providers.openai.configured ? "" : " (no key)"}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600" htmlFor="mc-model">Model id</label>
          <input id="mc-model" className={`${field} font-mono`} value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-stone-500">
        Still pick the closest <strong>model class</strong> above: providers don't publish model size, so energy per token remains an estimate even when token counts are exact.
      </p>
      <ol className="max-h-72 space-y-2 overflow-y-auto rounded border border-stone-200 bg-stone-50 p-2 text-sm" aria-label="Conversation">
        {turns.length === 0 && <li className="text-stone-400">No messages yet.</li>}
        {turns.map((t, i) => (
          <li key={i} className={t.role === "user" ? "text-right" : ""}>
            <span className={`inline-block max-w-[85%] whitespace-pre-wrap rounded px-2 py-1 text-left ${t.role === "user" ? "bg-stone-900 text-white" : "bg-white"}`}>{t.content}</span>
            {t.usage && (
              <span className="mt-0.5 block font-mono text-[11px] text-stone-500">
                {t.model} · exact usage: {t.usage.inputTokens} in · {t.usage.outputTokens} out
                {t.usage.reasoningTokens !== undefined && ` · ${t.usage.reasoningTokens} reasoning`}
              </span>
            )}
            {t.note && <span className="block text-[11px] text-[#8a5f00]">{t.note}</span>}
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <label htmlFor="mc-input" className="sr-only">Message</label>
        <textarea
          id="mc-input"
          rows={2}
          className={field}
          value={draft}
          placeholder="Message…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void send())}
        />
        <button className="self-end rounded bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" onClick={() => void send()} disabled={busy || !draft.trim()}>
          {busy ? "…" : "Send"}
        </button>
      </div>
      {error && <p className="text-sm text-cb-vermillion" role="alert">{error}</p>}
      {totals.calls > 0 && (
        <p className="text-xs text-stone-600" data-testid="metered-totals">
          The receipt shows the <strong>last API call</strong>. Conversation so far: {totals.calls} calls · {totals.input.toLocaleString()} input · {totals.output.toLocaleString()} output tokens (each call re-sends the history).
        </p>
      )}
    </div>
  );
}
