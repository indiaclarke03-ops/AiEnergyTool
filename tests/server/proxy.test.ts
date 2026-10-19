import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let upstream: Server;
let proxy: Server;
let base = "";
let lastAuth = "";

beforeAll(async () => {
  // Fake OpenAI-compatible upstream.
  const fake = express().use(express.json());
  fake.post("/v1/chat/completions", (req, res) => {
    lastAuth = req.headers.authorization ?? "";
    res.json({
      model: req.body.model,
      choices: [{ message: { content: "hello" } }],
      usage: { prompt_tokens: 12, completion_tokens: 30, completion_tokens_details: { reasoning_tokens: 10 } },
    });
  });
  upstream = fake.listen(0);
  process.env.OPENAI_API_KEY = "sk-test-secret";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}/v1`;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;

  const { createApp } = await import("../../server/index.ts");
  proxy = createApp().listen(0);
  base = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
});

afterAll(() => {
  upstream.close();
  proxy.close();
});

const post = (body: unknown) => fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("metered-chat proxy", () => {
  it("reports configured providers without leaking keys", async () => {
    const text = await (await fetch(`${base}/api/providers`)).text();
    expect(JSON.parse(text)).toMatchObject({ openai: { configured: true }, anthropic: { configured: false } });
    expect(text).not.toContain("sk-test-secret");
  });

  it("forwards to the OpenAI-compatible endpoint and returns exact usage", async () => {
    const r = await post({ provider: "openai", model: "test-model", messages: [{ role: "user", content: "hi" }] });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toMatchObject({ text: "hello", model: "test-model", usage: { inputTokens: 12, outputTokens: 20, reasoningTokens: 10 } });
    expect(lastAuth).toBe("Bearer sk-test-secret");
    expect(JSON.stringify(body)).not.toContain("sk-test-secret");
  });

  it("returns 503 when a provider key is missing", async () => {
    const r = await post({ provider: "anthropic", messages: [{ role: "user", content: "hi" }] });
    expect(r.status).toBe(503);
  });

  it("validates input", async () => {
    expect((await post({ provider: "x", messages: [] })).status).toBe(400);
    expect((await post({ provider: "openai", messages: [{ role: "system", content: "x" }] })).status).toBe(400);
    expect((await post({ provider: "openai", model: "bad model!", messages: [{ role: "user", content: "x" }] })).status).toBe(400);
  });
});
