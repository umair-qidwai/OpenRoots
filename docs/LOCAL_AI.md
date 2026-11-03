# Native local AI integration

Required mobile dependencies (mobile owner must install; this task does not edit package/config):
- `llama.rn@0.13.0-rc.9` (current npm latest; New Architecture required)
- `@openroots/local-integrity`: `file:./plugins/openroots-integrity` in the mobile package dependencies (local Expo native module; autolinked, no config plugin). **Do not use react-native-file-access for integrity**: its iOS SHA implementation loads the entire file via NSData, discovered by inspecting 4.0.4 native source.
- Expo SDK 58 compatible `expo-device`, `expo-file-system`, `expo-build-properties`, `expo-dev-client` via `npx expo install`.
- App config uses `['llama.rn', {enableEntitlements: process.env.OPENROOTS_EXTENDED_MEMORY === '1', entitlementsProfile:'production', forceCxx20:true, enableOpenCLAndHexagon:false}]`. Memory entitlements are opt-in for eligible teams and default off for free Xcode Personal Team signing. Keep Android CPU default. The integrity module is autolinked; no custom integrity config plugin is necessary.

Development build required; Expo Go and web cannot run this backend. Rebuild native app after installing dependencies. Do not add broad external-storage permissions. Models reside in private app document storage.

## Source verification

Hugging Face API queried 2026-11-02: `https://huggingface.co/api/models/ggml-org/Qwen3-4B-GGUF?blobs=true`.
Pinned revision: `2f3b082b1356a6123f7ed71e65aea340da25d53c`.
Artifact: `Qwen3-4B-Q4_K_M.gguf`, **2,497,280,640 bytes**.
LFS SHA-256: `ab27b9bfa375a178d6cba48f3ad892b94b7739659dcc7aae8058ce0ffed6b328`.
Model repository license: Apache-2.0. Model download is optional and separate from the application bundle.

Primary API references inspected:
- https://github.com/mybigday/llama.rn (README and npm package TypeScript declarations)
- https://github.com/expo/expo/blob/sdk-58/packages/expo-file-system/src/legacy/FileSystem.ts
- https://github.com/alpha0010/react-native-file-access (README and native hash source)

Expo 58's `expo-file-system/legacy` is deliberate: `createDownloadResumable`, native pause/resume tokens, disk-capacity methods remain here. The new File/Directory download API does not replace persisted resumable download state. Never import these deprecated functions from the package root (runtime errors).

## Download and lifecycle behavior

`modelManager` matches `ARCHITECTURE.md`; subscriptions start disk restoration without contacting any server. `getState()` adds `bytesDownloaded`, `totalBytes`, `warning`, `acceleration`, and `busy`. UI controls must respect `busy` and await/catch action errors. The provider does not silently download or load a model: users explicitly download, then load in Settings. Its constructor requires no arguments.

1. HEAD the revision-pinned URL with a 30-second timeout and require HTTP 200 and exact size. A real HEAD of this pinned URL returned **200 / 2497280640 bytes** during development. The CDN ETag is *not* treated as the LFS SHA-256.
2. Measure actual free/total disk capacity; conservatively reserve one complete artifact plus 512 MiB even for resume (native implementations can recreate the destination).
3. Transfer into private `local-ai/model.part`, using native progress bytes, not a timer. Native pause obtains opaque resume data; only then write a versioned, pinned checkpoint through a temporary metadata file. Resume never accepts a persisted alternate URL/path/checksum.
4. A resumable pause persists across manager/app restarts. If the OS kills the app before it can obtain/save a native pause token, or native resume data expires, a retry starts fresh rather than inventing valid resume state. Automatic retry is intentionally not unbounded.
5. Compare exact byte count and native streaming SHA-256 before moving into `model.gguf`; invalid content is never loadable. Restoration and every load recheck integrity, with no server dependency. Stale partial files without valid pause metadata are discarded. The model and native resume checkpoint may be removed in Settings.
6. A shared operation mutex covers transfer, hashing, load, inference, unload, and removal. Overlapping calls reject clearly; subscriber reentrancy is also locked. Background/inactive transitions pause transfer, stop generation, await the current operation, and release the context. No release during active inference. Foreground return does not unexpectedly resume inference/downloads or reload the model. Lifecycle listeners are removed by `dispose()` even when native cleanup reports errors.

## Native streaming integrity module

`apps/mobile/plugins/openroots-integrity` is a local Expo module, **not** an app-config plugin. Add the mobile dependency `"@openroots/local-integrity": "file:./plugins/openroots-integrity"` and reinstall before native prebuild. Expo Autolinking discovers it through dependency resolution; alternatively the mobile owner can set `expo.autolinking.nativeModulesDir` to `./plugins` in package.json. Do not configure both mechanisms unnecessarily. No `react-native-file-access` dependency is required.

The Swift implementation incrementally hashes an `InputStream` with CryptoKit SHA256. Kotlin incrementally feeds `MessageDigest`. Both use 1 MiB chunks, accept only files under canonical private document storage, and never send file bytes across the JS bridge. Missing native module means a truthful error, not a JS hashing fallback. Both platform descriptors were resolved successfully with the SDK 58 Expo Autolinking CLI using the explicit `apps/mobile/plugins` search path. This verifies discovery, not native compilation.

API references additionally checked against the SDK 58 source docs:
- https://github.com/expo/expo/blob/sdk-58/docs/pages/modules/module-api.mdx
- https://github.com/expo/expo/blob/sdk-58/docs/pages/modules/autolinking.mdx

## Native inference and limitations

Actual adapter calls: `initLlama`, `getFormattedChat`, `tokenize`, `completion`, `stopCompletion`, `release`. iOS attempts Metal (99 layers) and retries CPU if initialization fails; Android uses CPU (0 layers), not experimental OpenCL/Hexagon. The actual native `gpu/reasonNoGPU` result is displayed. Defaults: 4096 context, one sequence, 128-token batch, four threads, mmap, no mlock, 768 concise / 1152 detailed output tokens. Qwen thinking is disabled. Tokenized formatted input plus output/headroom must fit the configured context; oversized retrieval fails rather than silently dropping source context.

A physical device and development build are required. Devices below 4 GiB total RAM are refused; below 6 GiB are warned. This is **total RAM**, not an assertion that enough free memory exists: the OS can still kill the process and hardware testing remains mandatory. Free RAM and throughput are not fabricated.

Both providers share `buildMessages` and `parseAnswer`; local native JSON-schema constrained output still undergoes strict shared citation validation. Native errors, cancellation, invalid references, and truncated context reject. There is no simulated answer or cloud request path in local generation.

## Automated verification and remaining gates

Run from the repo root once mobile workspace dependencies are installed:

```sh
npx tsx --test apps/mobile/src/ai/*.test.ts
```

The mobile owner must include this glob in the mobile `test` script (currently that script may only select `tests/*.test.ts`). **17 tests passed**: integrity size/digest checks, malicious checkpoint rejection, native module streaming/discovery source checks, real shared parsing/citation rejection, native failure propagation, download/preflight, persisted pause/resume, Metal fallback, restart corruption, unsupported/low-memory devices, overlapping operations, background/abort cleanup, failing native stop/dispose, and subscriber reentrancy. Native boundaries are injected in behavior tests; source checks do not claim execution of Swift/Kotlin.

The installed `llama.rn@0.13.0-rc.9` declarations were checked with TypeScript: no local adapter API errors remained. At that check, the whole mobile typecheck was blocked by other owners' shared validation typing, `tests/core.test.ts` import-extension configuration, and transient safe-area declaration/install issues. A later workspace reinstall temporarily removed workspace links/tools; an isolated scratch tsconfig mapping `@openroots/shared` to its actual source was used for the final 17-test run. Re-run workspace typecheck/lint after installation stabilizes.

No Swift/Kotlin compiler, Xcode, Android SDK, attached phone, or inference invocation was available. **Native compilation and real device inference were not run.** Remaining gates on both target phones: build/autolink native module, compare SHA-256 to an independently known small file vector and this pinned model, download/pause/restart/resume (including expired tokens/low disk), load and generate with real retrieved Arabic passages, validate output citations, switch modes, cancel/background/memory-pressure, remove/reinstall, and run dictionary + local generation in airplane mode. Benchmark throughput, thermals, peak RAM, and adjust parameters only from measurements.
