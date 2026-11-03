import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeSearch,
  lexicalTerms,
  selectTranslation,
  safeEndpoint,
} from "../src/core/search.ts";
test("original search never normalizes its original fields", () => {
  const s = makeSearch("أَثَر", false, "book");
  assert.match(s.sql, /e.headword/);
  assert.ok(!s.sql.includes("normalized_headword"));
  assert.ok(s.params.includes("%أَثَر%"));
});
test("normalized search uses indexed normalized fields and escaped wildcards", () => {
  const s = makeSearch("أَثَر%", true);
  assert.match(s.sql, /normalized_headword/);
  assert.ok(s.params.includes("%اثر\\%%"));
});
test("lexical retrieval keeps source terms, not invented roots", () => {
  assert.deepEqual(lexicalTerms("What is the root of استغفار?"), ["استغفار"]);
});
test("translation must be a literal nonempty subset of cited text", () => {
  assert.equal(selectTranslation("هذا نص أصلي", "نص"), "نص");
  assert.throws(() => selectTranslation("هذا نص أصلي", "made up"));
});
test("cloud endpoint rejects non HTTPS and embedded credentials", () => {
  assert.throws(() => safeEndpoint("http://example.com"));
  assert.throws(() => safeEndpoint("https://a:b@example.com"));
  assert.equal(safeEndpoint("https://example.com/"), "https://example.com");
});
