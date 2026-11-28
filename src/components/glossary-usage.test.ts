import { describe, expect, it } from "vitest";
import { GLOSSARY } from "@/core/glossary";

// Every explanation in the glossary is shown somewhere (P-038); an unused entry is dead text.
const sources = Object.entries(
  import.meta.glob<string>(["./**/*.tsx", "!./**/*.test.tsx"], { query: "?raw", import: "default", eager: true }),
);

/** A key is used when a component passes it to Term (k=, term=), lists it in a key map, or reads GLOSSARY.key. */
function isUsed(key: string): boolean {
  const pattern = new RegExp(`(?:k|term)="${key}"|"${key}"\\s*[\\],]|:\\s*"${key}"|GLOSSARY\\.${key}\\b`);
  return sources.some(([, text]) => pattern.test(text));
}

describe("glossary", () => {
  it("finds the component sources", () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it.each(Object.keys(GLOSSARY))("%s is shown by some component", (key) => {
    expect(isUsed(key)).toBe(true);
  });
});
