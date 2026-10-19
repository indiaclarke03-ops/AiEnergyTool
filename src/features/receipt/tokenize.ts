// Approximate token counting with the o200k_base encoding (GPT-4o family). Lazy-loaded: the ranks file is large.
import type { Tiktoken } from "js-tiktoken/lite";

let encoder: Promise<Tiktoken> | null = null;

function getEncoder(): Promise<Tiktoken> {
  encoder ??= Promise.all([import("js-tiktoken/lite"), import("js-tiktoken/ranks/o200k_base")]).then(
    ([lite, ranks]) => new lite.Tiktoken(ranks.default),
  );
  return encoder;
}

export async function countTokens(text: string): Promise<number> {
  if (!text) return 0;
  return (await getEncoder()).encode(text).length;
}
