import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCloudResponse } from "../src/core/cloud-response";
import type { SourcePassage } from "@openroots/shared";
const p: SourcePassage = {
  id: "p-1",
  entryId: "e-1",
  bookId: "b-1",
  bookTitle: "Test source",
  author: "Test author",
  headword: "كتب",
  root: "كتب",
  text: "كتب",
  sourceUrl: "https://example.org/source",
  license: "test fixture",
  locator: null,
};
const model = "@cf/qwen/qwen3-30b-a3b-fp8";
const response = {
  sections: [
    {
      title: "Meaning",
      text: "A source-grounded explanation.",
      citations: ["p-1"],
    },
  ],
  insufficientEvidence: false,
  provider: "cloud",
  model,
};
test("accepts the Worker AIAnswer envelope while revalidating its citations", () =>
  assert.deepEqual(parseCloudResponse(response, [p], model), response));
test("rejects unknown citations in a Worker envelope", () =>
  assert.throws(
    () =>
      parseCloudResponse(
        {
          ...response,
          sections: [
            { title: "Meaning", text: "Bad citation", citations: ["invented"] },
          ],
        },
        [p],
        model,
      ),
    /citation/i,
  ));
test("rejects mismatched provider or model metadata", () => {
  assert.throws(() =>
    parseCloudResponse({ ...response, provider: "local" }, [p], model),
  );
  assert.throws(() =>
    parseCloudResponse({ ...response, model: "unexpected" }, [p], model),
  );
});
