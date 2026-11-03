import { test } from "node:test";
import assert from "node:assert/strict";
import { initializeServices } from "../src/core/initialize";
test("dictionary and user SQLite initialization cannot race the web WASM/VFS bootstrap", async () => {
  const order: string[] = [];
  let done!: () => void;
  const wait = new Promise<void>((resolve) => {
    done = resolve;
  });
  const ready = initializeServices(
    async () => {
      order.push("dictionary-start");
      await wait;
      order.push("dictionary-ready");
    },
    async () => {
      order.push("state-start");
    },
  );
  await Promise.resolve();
  assert.deepEqual(order, ["dictionary-start"]);
  done();
  await ready;
  assert.deepEqual(order, [
    "dictionary-start",
    "dictionary-ready",
    "state-start",
  ]);
});
