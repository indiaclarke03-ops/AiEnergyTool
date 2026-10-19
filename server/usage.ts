// Normalise provider `usage` objects into the shape the estimation engine needs. Pure, unit-tested.

export type MeteredUsage = {
  /** All input tokens the provider processed (incl. cached / cache-write tokens). */
  inputTokens: number;
  /** Visible output tokens (excluding hidden reasoning). */
  outputTokens: number;
  /** Hidden reasoning / thinking tokens, when the provider reports them; undefined if unknown. */
  reasoningTokens: number | undefined;
  /** Raw provider usage, kept for the research log. */
  raw: unknown;
};

/** OpenAI-compatible chat completions: completion_tokens already includes reasoning tokens. */
export function fromOpenAIUsage(u: {
  prompt_tokens?: number;
  completion_tokens?: number;
  completion_tokens_details?: { reasoning_tokens?: number | null } | null;
}): MeteredUsage {
  const completion = u.completion_tokens ?? 0;
  const reasoning = u.completion_tokens_details?.reasoning_tokens ?? undefined;
  return {
    inputTokens: u.prompt_tokens ?? 0,
    outputTokens: Math.max(0, completion - (reasoning ?? 0)),
    reasoningTokens: reasoning,
    raw: u,
  };
}

/**
 * Anthropic Messages API: input_tokens excludes cache reads/writes, so sum all three.
 * output_tokens includes thinking; output_tokens_details.thinking_tokens splits it out.
 */
export function fromAnthropicUsage(u: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  output_tokens_details?: { thinking_tokens: number } | null;
}): MeteredUsage {
  const thinking = u.output_tokens_details?.thinking_tokens;
  return {
    inputTokens: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    outputTokens: Math.max(0, u.output_tokens - (thinking ?? 0)),
    reasoningTokens: thinking,
    raw: u,
  };
}
