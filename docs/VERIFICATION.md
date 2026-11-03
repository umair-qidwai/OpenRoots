# Verification handoff

Recorded **2026-11-03 02:34 UTC**. Repository: `/home/umair/projects/OpenRoots`. At that verification snapshot, files were uncommitted. Subsequent GitHub publication is a separate operation; no backend deployment, signing or app-store submission was performed.

## Passed against the current source

- Workspace TypeScript checks: mobile, shared protocol and Worker, all exit 0.
- Mobile ESLint: exit 0, no warnings/errors.
- Mobile/core/local-provider tests: **73 passed, 0 failed**. Native runtime boundaries are injected in these tests; they do not claim execution of Swift/Kotlin or real model weights.
- Worker tests: **19 passed**. Shared contract tests: **8 passed**. External AI binding is injected; these are not live Cloudflare responses.
- Python ingestion tests: **9 passed**.
- Expo dependency compatibility check: up to date.
- Expo native project generation: `expo prebuild --no-install --platform all`, exit 0. This generates configuration; it is not native compilation.
- Local integrity Expo-module autolinking resolves on Apple and Android.
- Wrangler deployment dry-run: exit 0; AI and 6-request/minute limiter bindings recognized. No service was deployed.
- Current iOS, Android and web **JavaScript** exports: exit 0 with `expo export --platform all --no-bytecode --max-workers 1`. Native Hermes bytecode compilation was deliberately not claimed: the installed Linux compiler is x86-64 and this host is ARM64.
- Fresh, isolated real Chromium/Playwright smoke run: **13 UI checks passed**, with **4 actual screenshots** and no screenshot errors. The final check names/artifact list are in `UI_VERIFICATION.json`.
- Package lock validation: no empty/unversioned installed-package records. A previous interrupted-install corruption was removed through a clean install.
- `.gitignore` excludes temporary reference research, local secrets, generated native projects and signing material.

## What the browser actually exercised

Startup; original Home/search; real dictionary lookup; full original entry/attribution; bookmark write and persistence after a complete page reload; Home's real bookmarked entries; translation route and an exact source subset; highlighting the actual stable cited passage; comparison retrieval and a truthful missing-credential error instead of invented inference; Library's genuine count/license; Arabic dark UI without horizontal overflow; persisted language/theme after reload.

Screenshots under `docs/screenshots`: Home, dictionary, Saved, Arabic dark Settings. These are the implemented app, not mockups or reference-site assets. Browser SQLite uses the actual bundled corpus in memory and a lexical fallback; user state persists separately. Native retains bundled offline-file storage and FTS5.

## Data verified

One imported Lane digital edition, **49,473 entries / 55,668 passages**, database **221,884,416 bytes**, SHA-256 `99f586c21e1fdab14e5540c16669b839aeb11c2951fb08e7a9ec06a64a7051b0`. Exact source revision, attribution, license and skipped works: `SOURCE_MANIFEST.md`.

The real import includes 258 entries without an extracted digital headword. Original text is preserved/readable/bookmarkable; the absence is labeled and such rows are excluded from AI evidence/translation rather than inventing metadata. Regression tests include a real affected root and the requested sample questions against the shared contract.

## Important fixes verified

- Serialized web SQLite startup rather than racing WASM/VFS initialization.
- Direct read-only memory import for the web corpus to avoid a slow first-profile OPFS backup; native import unchanged.
- Indexed exact/root lookup and bounded FTS candidate search instead of full book-body scanning for native fallback.
- Exact headwords ranked before other entries under their source root.
- Shared corpus/mobile hamza/alif/mark normalization; original matching remains separate.
- Multiple-term comparison evidence retained in a compact local context.
- Source-preserving context compaction; no approximate root inference or fabricated passages.
- Revalidation of Worker response metadata/evidence without incorrectly passing transport fields into the strict model-output parser.
- Serialized durable user-state changes that do not publish failed disk writes or lose concurrent changes.
- Correct base reading direction for English lexicon prose mixed with Arabic lemmata, and RTL-aware Arabic navigation.

## GitHub packaging verification

The raw 221,884,416-byte DB is ignored and shipped in Git as a deterministic 45,571,264-byte gzip asset with both compressed/expanded SHA-256 hashes. Root `npm ci` restores it automatically. A fresh checkout of the staged Git index (without the raw DB) was restored with the actual setup script, verified by hash/size, and queried: 49,473 entries / 55,668 passages. `npm ci --ignore-scripts --dry-run` also validated that checkout's lockfile; this was a lockfile dry-run, not a native dependency installation. Five new tests cover restoration, idempotence, checksums, oversized expansion and preserving an existing different DB. Workspace typecheck/lint/tests passed again. A staged-source secret/shell/deserialization scan found no matches; generated build output, secrets and signing material remain excluded.

## Not verified / actions requiring the owner

1. **Native artifacts are absent on this Pi** because install scripts were intentionally skipped: `android/src/main/jniLibs` and `ios/rnllama.xcframework` are not installed here. On the build computer use ordinary `npm ci`, or unset `RNLLAMA_SKIP_POSTINSTALL` and run `npm rebuild llama.rn` before native compilation.
2. **No signed IPA or APK was produced.** This Linux ARM64 host has no Xcode, Android SDK manager or Java build toolchain available. Use the Mac/Xcode free Personal Team route for iPhone first, then local Android/EAS APK instructions.
3. **No physical-device test or real inference has run.** Download/resume integrity execution, Metal/CPU inference, performance/RAM/heat, cancel/background, actual airplane mode and accessibility need the phones.
4. **Cloudflare is not deployed/configured with owner credentials.** Route/authentication/model availability/quota and genuine answers must be verified after deliberate deployment and in-app token setup. No paid usage was enabled.
5. Optional dictionary packs, a general morphology/transliteration engine and injected OS selection-menu translation are not implemented. Transliteration has explicit limited spelling aliases, not root extraction. Lisān and other unverified editions are not bundled.

The code/data/browser handoff is ready for **native build testing**, not a claim that all physical definition-of-done gates are already met. Follow `docs/MOBILE.md` (iPhone first, then OnePlus); backend deployment steps are in `apps/worker/README.md`.
