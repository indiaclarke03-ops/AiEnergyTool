import { describe, expect, it } from "vitest";
import { fromAnthropicUsage, fromOpenAIUsage } from "../../server/usage.ts";

describe("usage normalisation", () => {
  it("OpenAI: completion tokens include reasoning tokens", () => {
    const u = fromOpenAIUsage({ prompt_tokens: 120, completion_tokens: 900, completion_tokens_details: { reasoning_tokens: 700 } });
    expect(u).toMatchObject({ inputTokens: 120, outputTokens: 200, reasoningTokens: 700 });
  });

  it("OpenAI: no reasoning details → reasoning unknown", () => {
    expect(fromOpenAIUsage({ prompt_tokens: 10, completion_tokens: 20 }).reasoningTokens).toBeUndefined();
  });

  it("Anthropic: input sums cache reads/writes; thinking split from output", () => {
    const u = fromAnthropicUsage({
      input_tokens: 50,
      cache_creation_input_tokens: 1000,
      cache_read_input_tokens: 2000,
      output_tokens: 800,
      output_tokens_details: { thinking_tokens: 600 },
    });
    expect(u).toMatchObject({ inputTokens: 3050, outputTokens: 200, reasoningTokens: 600 });
  });
});
