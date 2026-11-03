import { test } from "node:test";
import assert from "node:assert/strict";
import { compactPassages, conversationContext } from "../src/core/ai-context";
import type { SourcePassage } from "@openroots/shared";
const p = (id: string, text: string): SourcePassage => ({
  id,
  entryId: id,
  bookId: "lane",
  bookTitle: "Lane",
  author: "Lane",
  headword: "كتب",
  root: "كتب",
  text,
  sourceUrl: "https://example.org",
  license: "CC-BY-SA-3.0-US",
  locator: null,
});
test("local context selects complete real passages within its conservative budget", () => {
  const input = [
    p("too-long", "x".repeat(5500)),
    p("a", "original words"),
    p("b", "another source"),
  ];
  const rows = compactPassages(input, "local");
  assert.deepEqual(rows, [input[1], input[2]]);
  assert.ok(JSON.stringify(rows).length < 4500);
});
test("cloud and local history stay bounded without changing saved conversation", () => {
  const messages = [
    {
      question: "q".repeat(1800),
      answer: { sections: [{ text: "a".repeat(5000) }] },
    },
  ];
  const local = conversationContext(messages, "local");
  assert.ok(local.reduce((n, t) => n + t.content.length, 0) <= 1000);
  assert.equal(messages[0]!.answer.sections[0]!.text.length, 5000);
});
