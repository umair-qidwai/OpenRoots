import { readFile } from "node:fs/promises";
import path from "node:path";
import { prepareDictionary } from "./dictionary-assets.mjs";
const mobile = path.resolve(import.meta.dirname, "..");
const bundled = path.join(mobile, "assets/bundled");
const manifest = JSON.parse(
  await readFile(path.join(bundled, "manifest.json"), "utf8"),
);
if (manifest.schemaVersion !== 1 || manifest.archive !== "openroots.db.gz")
  throw new Error("Unsupported bundled dictionary manifest");
const status = await prepareDictionary({
  archivePath: path.join(bundled, manifest.archive),
  targetPath: path.join(mobile, "assets/dictionaries/openroots.db"),
  expectedSha256: manifest.sha256,
  expectedSize: manifest.sizeBytes,
  compressedSha256: manifest.compressedSha256,
});
console.log(
  status === "prepared"
    ? "Restored and SHA-256 verified the bundled dictionary."
    : "Bundled dictionary already present and SHA-256 verified.",
);
