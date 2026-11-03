import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSearch } from "../src/core/search.ts";
test("normalized fallback uses FTS candidates rather than scanning passage bodies", () => {
  const q = makeSearch("خشية");
  assert.match(q.sql, /passages_fts MATCH/);
  assert.doesNotMatch(q.sql, /normalized_text LIKE/);
});
test("original matching is filtered against original source text even with normalized FTS candidates", () => {
  const q = makeSearch("خَشْيَة", false);
  assert.match(q.sql, /e.text LIKE/);
  assert.ok(q.params.includes("%خَشْيَة%"));
  assert.doesNotMatch(q.sql, /normalized_headword/);
});
