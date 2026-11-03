# OpenRoots

An original Classical Arabic research app: real offline dictionary text, source-linked AI explanations, word comparison, and attributed passage translation. Built with Expo SDK **58.0.22**, React Native **0.88.1**, React **19.3**, TypeScript, Expo Router, and SQLite FTS5.

**Status:** software handoff for native-build testing; automated checks and a real exported-browser smoke test have been exercised. This is not a claim of physical iPhone/Android acceptance. A signed native build, real model inference, and live Cloudflare invocation still require the appropriate build host, phone, and credentials. See [mobile installation and acceptance instructions](docs/MOBILE.md).

**Start here:** [simple iPhone + OnePlus installation guide](docs/INSTALL.md).

## Repository

- `apps/mobile`: iOS/Android app and native-development configuration; optional browser preview.
- `apps/worker`: authenticated Cloudflare Workers AI service.
- `packages/shared`: one grounded AI input/output contract, prompt, normalization and strict citation validation.
- `tools/ingest`: reproducible Python XML-to-SQLite ingestion and tests.
- `apps/mobile/assets/dictionaries`: restored real dictionary DB and source manifest. The pinned Git asset is `apps/mobile/assets/bundled/openroots.db.gz`; `npm ci` restores and verifies the DB automatically.
- `licenses/sources`: source licensing/attribution records; font license is beside the bundled font.
- `ARCHITECTURE.md`: interfaces and ownership/integration contracts.
- `docs/REQUIREMENTS.txt`: complete original specification, retained without reducing scope.

## What the app does

- Search original Arabic spelling, diacritic-insensitive spelling, source-attested roots and English text. Bounded FTS5 retrieval and indexed exact/root lookup operate offline.
- Read full original entries; search within an entry, copy text, bookmark, resize Arabic text and open original source links.
- Open AI citations at the highlighted stable source passage. AI translations/interpretations are labeled separately from original text.
- Compare two words and translate an explicit, verbatim subset of a cited passage.
- Switch Cloud/Local without discarding conversation. Saved explanations, bookmarks, research history and settings persist in app-private SQLite.
- Configure a private Worker URL/access token; query available Cloud models. Native tokens use OS SecureStore, never a bundled credential.
- Download, pause/resume, verify, load, unload and remove the optional local GGUF model. Progress derives from native transfer bytes, not a simulation. Streaming native SHA-256 uses bounded buffers.
- English/Arabic interface, selectable text, RTL-aware layouts, ivory/forest/charcoal light and dark themes, and bundled OFL-licensed Noto Naskh Arabic.

## Install dependencies

Use Node **22.13+**; Node 24 was used for verification. Workspaces are configured at the root. `.npmrc` retains the peer-resolution strategy used by the lockfile; required peers are declared explicitly.

```sh
git clone https://github.com/umair-qidwai/OpenRoots.git
cd OpenRoots
npm ci
npm run start
```

`npm ci` runs llama.rn's native-artifact download. Allow sufficient disk space and a trusted connection. **For source-only checking on a constrained host**, use `RNLLAMA_SKIP_POSTINSTALL=1 npm ci`; before a native build, unset that variable and run `npm rebuild llama.rn`. An install with `--ignore-scripts` does not prove native artifacts are installed and skips dictionary restoration: run `npm run prepare:assets` explicitly afterwards for source-only checks. Both compressed and expanded dictionary SHA-256/size are checked; an existing different DB is never silently overwritten.

Expo Go cannot provide local inference. Use a native development build or a standalone release/preview build. A development build normally needs Metro; a standalone release/preview includes the JS bundle and can run without the computer. The local model is downloaded separately, never embedded in the app bundle.

## Checks

```sh
npm run typecheck
npm run lint
npm test
python3 -m unittest discover -s tools/ingest -p 'test*.py'
cd apps/mobile
npx expo install --check
npx expo config --type public
npx expo prebuild --no-install
```

On supported desktop build hosts, `npx expo export --platform all --max-workers 1` checks bundles and Hermes bytecode. On Linux ARM64, the shipped Linux Hermes compiler is x86-64; use `--no-bytecode` only for an explicit JS/export check, not as evidence of a native release build. Generated `ios`, `android` and `dist` directories are ignored.

## Native phone installation

Follow [docs/MOBILE.md](docs/MOBILE.md), **iPhone first, then OnePlus**. A Mac/Xcode and free Apple Personal Team can sign directly for personal testing with Apple's short-lived free provisioning; TestFlight is not required. Android APKs can be built locally and installed directly without Google Play. No app-store submission or backend deployment has been performed.

## Cloud AI

Default model: `@cf/qwen/qwen3-30b-a3b-fp8`. The worker also probes `@cf/google/gemma-4-26b-a4b-it`; catalog presence does not guarantee access on your account.

The mobile app posts to `/v1/generate` and queries `/v1/models` with a **personal Worker access token**, not a Cloudflare account API key. Set `ACCESS_TOKEN` as a Worker secret (32–256 printable non-whitespace ASCII characters), configure a private reachable route, and only then enter its HTTPS base URL/token in mobile Settings. The checked-in worker disables public workers.dev and preview URLs, has no secret, fails closed, and has a 6-request/minute limiter. `GET /v1/models` performs small inference probes and can consume quota. Cloud invocation requires your approval/credentials; nothing is deployed automatically. Free-tier quotas are account-side limits, not a promise of free unlimited usage.

## Local AI

Pinned Qwen3 4B Q4_K_M GGUF, approximately 2.50 GB, Apache-2.0. Artifact revision, digest, native lifecycle/integrity behavior and remaining hardware gates: [docs/LOCAL_AI.md](docs/LOCAL_AI.md).

Android defaults to CPU. iOS attempts Metal with CPU fallback. Exact performance and memory use must be measured on the phones. Native generation is real llama.rn integration, not simulated inference; absence of a supported native module/model produces a visible error. Local questions are never silently uploaded. Optional Cloud-to-Local fallback must be explicitly enabled and requires an already-loaded model.

## Data and attribution

The current bundled work is **Edward William Lane, An Arabic-English Lexicon**, original digitization by the Perseus Digital Library at Tufts, with Alpheios corrections. The digital edition is **CC BY-SA 3.0 US**, from `alpheios-project/lan` revision `7dd04e1182c13a4b0883978867d2a3b04616542a`. The manifest records **49,473 entries / 55,668 passages**. Preserve attribution and the edition's ShareAlike obligations when redistributing its data or adaptations; do not relabel the corpus as permissively licensed app code. See `licenses/sources/lane-README.md`, the saved license, and `data/sources/lane.lock.json`.

The DB preserves source text rather than manufacturing Arabic definitions. Lane's definitions are primarily English with Arabic lemmata and quotations. Lisān al-ʿArab and other desired titles are **not** claimed bundled. No OpenITI NC-SA text is silently included. Only categories with imported material appear in Library. Source research documents are retained under `licenses/sources` and `docs/REFERENCE_RESEARCH.md`; temporary reference screenshots/assets are excluded from shipping.

## Explicit remaining scope and acceptance gates

- Physical iOS/Android compilation, native integrity execution, real model download/inference, heat/memory/background/airplane-mode tests and live Cloud AI are separate acceptance gates, not implied by unit tests or prebuild.
- Optional dictionary download packs are not implemented. The bundled dictionary is the offline collection.
- Transliteration uses a small explicit spelling-alias set plus imported English text; it is not a general transliterator or morphology/root-extraction engine.
- Translation uses a literal subset editor, not an injected custom OS selection-menu action.
- The browser target uses a real-data lexical fallback because Expo's default SQLite WASM does not include FTS5; native builds use FTS5. Local AI is unavailable in the browser. Browser Cloud use also needs a server CORS policy if hosted separately; native requests are not subject to browser CORS.
- No embeddings, voice, OCR, subscription, analytics or account system is pretended to exist.
