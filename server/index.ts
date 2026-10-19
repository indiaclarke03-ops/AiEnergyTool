// Metered-chat proxy (milestone M5). Keeps API keys server-side; the browser only ever sees text + usage.
// Run with: npm run server   (reads .env via Node's --env-file-if-exists)
import Anthropic from "@anthropic-ai/sdk";
import express, { type Request, type Response } from "express";
import { fromAnthropicUsage, fromOpenAIUsage, type MeteredUsage } from "./usage.ts";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatRequest = { provider: "anthropic" | "openai"; model?: string; messages: ChatMessage[] };
type ChatResponse = { text: string; model: string; usage: MeteredUsage; note?: string };

const PORT = Number(process.env.PROXY_PORT ?? 8787);
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
const DEFAULT_MODELS = { anthropic: "claude-opus-5-5", openai: process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4o-mini" };
const MAX_TOKENS = 16000;
// Models that accept server-side refusal fallbacks ("default" routing by refusal category).
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

const anthropic = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? new Anthropic() : null;

function validate(body: unknown): ChatRequest {
  const b = body as Partial<ChatRequest>;
  if (b?.provider !== "anthropic" && b?.provider !== "openai") throw new HttpError(400, "provider must be 'anthropic' or 'openai'");
  if (!Array.isArray(b.messages) || b.messages.length === 0) throw new HttpError(400, "messages must be a non-empty array");
  for (const m of b.messages) {
    if ((m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") throw new HttpError(400, "each message needs role user|assistant and string content");
  }
  if (b.model !== undefined && (typeof b.model !== "string" || !/^[\w.:/-]{1,100}$/.test(b.model))) throw new HttpError(400, "invalid model id");
  return b as ChatRequest;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function chatAnthropic(req: ChatRequest): Promise<ChatResponse> {
  if (!anthropic) throw new HttpError(503, "ANTHROPIC_API_KEY is not set on the proxy");
  const model = req.model || DEFAULT_MODELS.anthropic;
  const useFallbacks = FALLBACK_MODELS.has(model);
  try {
    const msg = await anthropic.beta.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      messages: req.messages,
      betas: ["thinking-token-count-2026-05-13", ...(useFallbacks ? (["server-side-fallback-2026-07-01"] as const) : [])],
      ...(useFallbacks ? { fallbacks: "default" as const } : {}),
    });
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
    const note =
      msg.stop_reason === "refusal"
        ? `The model declined (${msg.stop_details?.category ?? "no category"}). Tokens were still processed and are counted.`
        : msg.model !== model
          ? `Served by fallback model ${msg.model}.`
          : undefined;
    return { text, model: msg.model, usage: fromAnthropicUsage(msg.usage), note };
  } catch (e) {
    if (e instanceof Anthropic.APIError) throw new HttpError(e.status ?? 502, `Anthropic API error: ${e.message}`);
    throw e;
  }
}

async function chatOpenAI(req: ChatRequest): Promise<ChatResponse> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new HttpError(503, "OPENAI_API_KEY is not set on the proxy");
  const model = req.model || DEFAULT_MODELS.openai;
  const r = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: req.messages }),
  });
  const data = (await r.json().catch(() => ({}))) as {
    model?: string;
    choices?: { message?: { content?: string | null } }[];
    usage?: Parameters<typeof fromOpenAIUsage>[0];
    error?: { message?: string };
  };
  if (!r.ok) throw new HttpError(r.status, `OpenAI-compatible API error: ${data.error?.message ?? r.statusText}`);
  if (!data.usage) throw new HttpError(502, "Provider response had no usage block; cannot meter tokens");
  return { text: data.choices?.[0]?.message?.content ?? "", model: data.model ?? model, usage: fromOpenAIUsage(data.usage) };
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Which providers are configured — booleans only, never keys.
  app.get("/api/providers", (_req, res) => {
    res.json({
      anthropic: { configured: anthropic !== null, defaultModel: DEFAULT_MODELS.anthropic },
      openai: { configured: Boolean(process.env.OPENAI_API_KEY), defaultModel: DEFAULT_MODELS.openai, baseUrl: OPENAI_BASE_URL },
    });
  });

  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      const body = validate(req.body);
      res.json(body.provider === "anthropic" ? await chatAnthropic(body) : await chatOpenAI(body));
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      res.status(status).json({ error: e instanceof Error ? e.message : "Unknown error" });
    }
  });
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Bind to localhost only: this proxy spends the operator's API credit.
  createApp().listen(PORT, "127.0.0.1", () => console.log(`Metered-chat proxy on http://127.0.0.1:${PORT}`));
}
