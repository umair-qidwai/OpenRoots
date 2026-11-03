import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { makeSearch, normalize } from "../src/core/search.ts";
const db = new DatabaseSync(
  path.resolve(import.meta.dirname, "../assets/dictionaries/openroots.db"),
  { readOnly: true },
);
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
  test("real bundled lookup: " + word, () => {
    const key = normalize(word);
    let rows = db
      .prepare(
        "SELECT id FROM entries WHERE normalized_headword=? OR normalized_root=? LIMIT 60",
      )
      .all(key, key);
    if (!rows.length) {
      const q = makeSearch(word);
      rows = db.prepare(q.sql).all(...q.params);
    }
    assert.ok(rows.length > 0, "No real entry for " + word);
  });
test("FTS5 queries return stable cited passages", () => {
  const rows = db
    .prepare(
      "SELECT p.id,p.entry_id,p.text FROM passages p JOIN passages_fts f ON f.passage_id=p.id WHERE passages_fts MATCH ? LIMIT 8",
    )
    .all('"خوف"');
  assert.ok(rows.length);
  for (const p of rows) {
    assert.ok(p.id);
    assert.ok(p.entry_id);
    assert.ok(String(p.text).length);
  }
});
