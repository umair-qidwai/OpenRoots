import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { DictionaryRepository } from "../src/core/repository.ts";
import { normalize } from "../src/core/search";
import { compactPassages } from "../src/core/ai-context";
import { validateAIInput } from "@openroots/shared";
const db = new DatabaseSync(
  path.resolve(import.meta.dirname, "../assets/dictionaries/openroots.db"),
  { readOnly: true },
);
const repo = new DictionaryRepository({
  getAllAsync: async <T>(
    sql: string,
    params: (string | number | null)[] = [],
  ) => db.prepare(sql).all(...params) as T[],
  getFirstAsync: async <T>(
    sql: string,
    params: (string | number | null)[] = [],
  ) => (db.prepare(sql).get(...params) as T) ?? null,
});
test("comparison retrieval retains evidence for both requested words, including local context", async () => {
  const rows = await repo.retrieve("Compare خوف and خشية");
  for (const passages of [rows, compactPassages(rows, "local")]) {
    assert.ok(
      passages.some((p) => normalize(p.text).includes("خوف")),
      "missing خوف evidence",
    );
    assert.ok(
      passages.some((p) => normalize(p.text).includes("خشية")),
      "missing خشية evidence",
    );
  }
});
test("an exact headword is ranked before other entries under the same source root", async () => {
  const rows = await repo.search("صبر");
  assert.equal(normalize(rows[0]!.headword), "صبر");
});
for (const question of [
  "What is the root of استغفار?",
  "What is the difference between خوف and خشية?",
  "Explain the Classical Arabic meaning of تقوى.",
  "Compare رحمة and رأفة.",
  "Find relevant entries for صبر.",
]) {
  test(
    "real retrieval satisfies the shared AI contract: " + question,
    async () => {
      const passages = await repo.retrieve(question);
      assert.ok(passages.length);
      assert.doesNotThrow(() => validateAIInput(question, passages));
    },
  );
}
test("entries without a digital headword never poison the AI evidence envelope", async () => {
  const roots = db
    .prepare(
      "SELECT DISTINCT root FROM entries WHERE trim(headword)='' AND root IS NOT NULL LIMIT 50",
    )
    .all() as { root: string }[];
  for (const { root } of roots) {
    const passages = await repo.retrieve(root);
    assert.doesNotThrow(() => validateAIInput(root, passages), root);
  }
});
for (const word of [
  "كتب",
  "علم",
  "رحمة",
  "صبر",
  "خوف",
  "خشية",
  "تقوى",
  "غفر",
  "هدى",
  "نور",
])
  test("app repository real data search " + word, async () => {
    const rows = await repo.search(word);
    assert.ok(rows.length > 0);
    const entry = await repo.entry(rows[0]!.id);
    assert.ok(entry?.text);
  });
test("AI retrieves deterministic real passages, no score leaks into shared payload", async () => {
  const a = await repo.retrieve("Compare خوف and خشية");
  const b = await repo.retrieve("Compare خوف and خشية");
  assert.ok(a.length > 0);
  assert.deepEqual(a, b);
  for (const p of a) {
    assert.ok(p.id);
    assert.ok(p.entryId);
    assert.equal("score" in p, false);
    const actual = await repo.passages(p.entryId);
    assert.ok(actual.some((x) => x.id === p.id && x.text === p.text));
  }
});
