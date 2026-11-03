# OpenRoots: build, install and test on your phones

**Order: iPhone 15 first, then OnePlus. Neither requires public app-store publication.** These instructions describe how to make signed builds; no signed IPA/APK has been manufactured on this Linux ARM64 host. Native compilation, signing and actual inference remain phone/build-host acceptance gates.

The application is Expo SDK 58.0.22 / React Native 0.88.1 / React 19.3 with native SQLite FTS5, llama.rn and a local Expo module for streaming SHA-256. **Do not use Expo Go** to test local AI.

## 0. Get the project onto your build computer

The working source is `/home/umair/projects/OpenRoots` on the Pi. The simple GitHub installation path is in `docs/INSTALL.md`. Clone with `git clone https://github.com/umair-qidwai/OpenRoots.git`, then run `npm ci`; this restores/checks the compressed dictionary automatically. Alternatively, copy the Pi directory without generated dependencies/builds. From a Mac terminal, replacing `<PI_ADDRESS>` with the Pi's reachable address:

```sh
mkdir -p "$HOME/Projects/OpenRoots"
rsync -av \
  --exclude=node_modules --exclude=.git --exclude=.expo \
  --exclude=research --exclude=dist --exclude=apps/mobile/ios \
  --exclude=apps/mobile/android --exclude=data/sources/lane-alpheios.tar.gz \
  umair@<PI_ADDRESS>:/home/umair/projects/OpenRoots/ \
  "$HOME/Projects/OpenRoots/"
cd "$HOME/Projects/OpenRoots"
```

Keep `apps/mobile/assets/dictionaries`, `apps/mobile/plugins`, `packages/shared`, the lockfile, and the licenses. The bundled dictionary is substantial; it must be copied with the source. Do not copy the Pi's `node_modules` to a Mac or Windows computer.

Install a supported Node release (22.13 or later; 24 used here), then:

```sh
npm ci
npm run typecheck
npm run lint
npm test
```

`npm ci` automatically restores/checks the bundled dictionary and runs llama.rn's postinstall to download and checksum its native artifacts for iOS/Android. Expect a large download and provide sufficient disk space for native SDKs/builds. If you previously installed with `--ignore-scripts` or `RNLLAMA_SKIP_POSTINSTALL=1`, run this **before building**:

```sh
unset RNLLAMA_SKIP_POSTINSTALL
npm rebuild llama.rn
```

A successful TypeScript check or `expo prebuild` is not proof those binaries are installed. The optional 2.50 GB **inference model is a separate, in-app download**; do not download it onto the Pi for these checks.

## 1. iPhone 15: free Xcode Personal Team installation

### Requirements

- A **Mac** with Xcode compatible with your iPhone's current iOS, Xcode command-line tools, and CocoaPods.
- Your Apple Account added in **Xcode > Settings > Accounts**. A free Personal Team is sufficient for direct personal testing; a paid membership/TestFlight is not required for this route.
- iPhone connected by USB, unlocked, and the **Trust This Computer** prompt accepted. Enable **Settings > Privacy & Security > Developer Mode** when prompted; restart the phone if iOS requests it.

Apple's free provisioning is short-lived (normally 7 days): rebuild/re-sign before or after expiry to keep launching. This is an Apple signing limit, not an OpenRoots subscription. Avoid deleting the app unnecessarily if you want to preserve its app-private dictionary/model/settings.

### Create the native project

From the copied repository:

```sh
cd "$HOME/Projects/OpenRoots/apps/mobile"
# Choose a unique ID for your account; keep it the same for later reinstalls.
export OPENROOTS_IOS_BUNDLE_ID=org.openroots.umair
# Leave optional paid-team memory entitlements off for Personal Team signing.
unset OPENROOTS_EXTENDED_MEMORY
npx expo prebuild --platform ios
open ios/OpenRoots.xcworkspace
```

The last command opens the workspace **after CocoaPods completes**. Do not open just `.xcodeproj` when pods are used. If CocoaPods/Xcode setup fails, finish that platform setup first; do not work around a missing native module with a fake JS provider.

### Configure free signing in Xcode

1. Select the **OpenRoots** project, then the **OpenRoots app target**.
2. Under **Signing & Capabilities**, enable **Automatically manage signing** and select your **Personal Team**.
3. Confirm the Bundle Identifier matches your chosen unique ID. For configuration updates, keep the environment variable above or put it in `apps/mobile/.env` (no access token there).
4. Select the connected **iPhone**, not an iOS Simulator, as the run destination.
5. To install a standalone app, choose **Product > Scheme > Edit Scheme > Run > Info > Build Configuration: Release**. Then press Run. A Release build embeds the JS/dictionary assets and does not need Metro.
6. If iOS asks to trust the developer certificate, follow its Settings prompt. Launch **OpenRoots** on the phone.

Alternatively, after Xcode signing is configured:

```sh
npx expo run:ios --device --configuration Release
```

For development/debugging instead:

```sh
npx expo run:ios --device
npx expo start --dev-client
```

**Debug/development builds generally need the Metro server; do the airplane-mode acceptance test with a Release build.**

### Memory-entitlement note

Optional extended-virtual-addressing/increased-memory entitlements are off by default so they do not block free Personal Team signing. An eligible Apple team can opt in with `OPENROOTS_EXTENDED_MEMORY=1` before prebuild. Do not enable this blindly on a free team. The 4B model's actual memory use on an iPhone 15 still needs testing; the OS can terminate a process under memory pressure even when storage is sufficient. Dictionary browsing does not need the model.

### Renew after free signing expires

Reconnect the same phone, select the same Team and Bundle Identifier, and rebuild/re-run. Do not uninstall merely to renew signing. Back up anything important before experimenting with signing, bundle IDs or uninstalling; changing the app identity can create a fresh app data container.

## 2. OnePlus: build and install an APK

There is no Apple-style weekly signing expiry for a sideloaded APK and no Google Play membership is needed. Keep the same package ID and signing key for updates.

### Option A: local build, no cloud-build subscription

On a Mac, Linux x86-64 or Windows development computer, install Android Studio and its Android SDK, platform/build tools and the JDK compatible with the generated Gradle/Android plugin. Follow Expo's Android environment setup rather than guessing SDK versions. The constrained ARM64 Pi is not the recommended native build computer.

On the OnePlus, enable **Developer options** and **USB debugging**, connect USB, then accept the phone's computer authorization prompt. Verify:

```sh
adb devices
```

Your device should be listed as `device`, not `unauthorized`. From the mobile directory:

```sh
cd "$HOME/Projects/OpenRoots/apps/mobile"
npx expo prebuild --platform android
npx expo run:android --device --variant release
```

This builds and installs the standalone Release variant. For a reusable APK without automatically installing, use the generated wrapper:

```sh
cd android
# macOS / Linux
./gradlew :app:assembleRelease
# Windows PowerShell, instead:
# .\gradlew.bat :app:assembleRelease
```

The standard output is:

```text
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

For local personal testing, Expo's generated Android template normally signs Release with its debug keystore unless you configure your own release signing. That is acceptable for a private test, **not a production signing strategy**. Keep the same keystore for updating that installation; back it up privately. For separately managed release signing, use the EAS option or configure a private keystore—never check secrets into source control.

### Install the APK on the phone

Either:

1. Transfer `app-release.apk` to the phone (USB file transfer or your own trusted download).
2. Open it in Files. Allow **Install unknown apps** for that file/browser app if Android prompts, then install.
3. Revoke that install permission afterwards if you do not need it.

Or install over USB:

```sh
adb install -r /path/to/app-release.apk
```

`-r` updates an existing app **only when its package/signature match**. A signature-mismatch error is not fixed by pretending the update worked: use the original key, or explicitly accept that uninstalling loses private app data. Do not bypass a security warning for an APK from an unknown source. If direct file installation is restricted by your Android configuration, use the supported USB developer installation route for your own build.

### Option B: Expo EAS cloud build

If you prefer not to configure the Android SDK locally, use your Expo account and its current build allowance; free quotas/queues are subject to Expo's plan. No Google Play publication is required:

```sh
cd "$HOME/Projects/OpenRoots/apps/mobile"
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

Review/accept account association and signing-key generation yourself. The checked-in `preview` profile explicitly requests an **APK**, not an AAB, and is standalone rather than a development client. Download the resulting APK from your build page and install as above. EAS iOS internal distribution generally requires paid Apple signing; use the free Xcode route in section 1 instead.

## 3. First acceptance test: dictionary and persistence, no AI credentials needed

On **each phone**, using a standalone Release/preview build:

1. Launch OpenRoots. Search `كتب`, `علم`, `رحمة`, `صبر`, `خوف`, `خشية`, `تقوى`, `غفر`, `هدى`, `نور`.
2. Open an entry. Confirm its real title/author/locator and original source text; copy a passage, search within the entry and change Arabic text size.
3. Switch normalized/original-spelling search. Original mode must filter original headword/root/body, not silently display normalized matches as exact originals.
4. Try a supported spelling alias such as `khawf` or `ṣabr`; it is a spelling aid, not inferred morphology.
5. Bookmark an entry. Quit/relaunch the app and confirm the bookmark/history/appearance/font-size settings survive.
6. In Library, inspect the actual imported work and source/license. Only Lane's digital edition is currently bundled; Lisān is not claimed present.
7. Change English/Arabic and light/dark/system appearance. Check connected letters, diacritics, RTL layout, long English/Arabic passages, selectable text, phone rotation and readable buttons.
8. Enable airplane mode, fully quit and relaunch. Search and read the bundled dictionary again. No account/network is required for that.

## 4. Local AI test

1. Turn the network back on. In **Settings > On-device model**, check free storage. The pinned model is **2,497,280,640 bytes**, with additional working-space requirements.
2. Tap **Download / verify**. Progress must reflect actual downloaded bytes. Pause, quit/relaunch, and resume; a stale/invalid native checkpoint may require a fresh download rather than an unsafe fake resume.
3. Wait for integrity verification and `ready`. Tap **Load** and wait for `loaded`. Inspect the reported acceleration/warnings.
4. Choose **Local** in Assistant, ask about `صبر`, then use **Compare words** for `خوف` / `خشية`. Tap a citation: the actual cited passage should be highlighted in its entry.
5. Open an entry, choose **Translate this passage**, edit down to an exact literal subset, and translate. The original and AI-generated translation remain distinct and attributed. Use a shorter subset if the model's tokenizer reports that it exceeds context.
6. Save an explanation, change providers and return; conversation and saved explanation must persist.
7. Enable airplane mode, restart the app, explicitly **Load** the installed model again, choose Local, and repeat. Native inference must not need a network connection.
8. Cancel a request and test background/foreground. The model intentionally unloads on background for safety; returning to the app does not silently reload/start inference.
9. Test **Unload**, **Delete model**, and its absent state. No invented fallback answer should appear when the model is missing.

Download/load/inference timings, temperature and RAM behavior must be measured on your phones; they have not been fabricated. Local inference is not promised to fit every phone configuration.

## 5. Cloud AI test

This requires your authenticated, privately deployed Worker. Nothing is deployed automatically. Configure `ACCESS_TOKEN` server-side, AI/rate-limit bindings and a reachable HTTPS route. The checked-in worker disables public workers.dev/preview URLs until you deliberately configure deployment. See `ARCHITECTURE.md` and the root README.

In mobile **Settings > Cloud connection**, enter the base URL and personal Worker access token. **Do not enter a Cloudflare account API token.** Save, then check model availability (the check performs tiny quota-consuming inference probes). Select an available model, choose Cloud, ask a question, inspect citations, retry a failed request and verify provider switching preserves the conversation. A quota/rate-limit error should offer Local; opt-in fallback only runs an already-loaded installed local model.

Native tokens are kept in OS SecureStore. No token is in the app bundle or this repository. Browser-preview tokens are memory-only, and browser requests additionally need an appropriate Worker CORS policy; native mobile is the supported Cloud target.

## 6. Browser preview and host checks

The browser is a convenience preview, not the on-device AI target. `metro.config.js` adds WASM assets and COOP/COEP headers. Expo's default SQLite WASM has no FTS5, so the web repository uses a real-data lexical fallback; Android/iOS use FTS5. No mock dictionary is substituted. The web preview fetches the genuine bundled DB into a read-only memory database to avoid a large first-profile OPFS backup; its user settings/bookmarks still use persistent SQLite. Native dictionary storage remains a bundled on-device file. Browser preview therefore needs the asset server after a full reload and is not the native airplane-mode acceptance target.

```sh
cd apps/mobile
npx expo start --web
# or export and serve using the included isolation-header server:
npx expo export --platform web --max-workers 1
python3 scripts/serve-preview.py
# In another terminal, against that running export:
node scripts/ui-smoke.mjs
```

The smoke script uses the installed Chromium/Google Chrome via Playwright, creates an isolated browser context and records actual UI checks/screenshots under `docs/`. Set `CHROME_BIN` if Chrome lives elsewhere. It never substitutes mock dictionary entries or fake inference. The native build/device gates remain separate.

For a Linux ARM64 JS-only export check, `--no-bytecode` avoids the bundled x86-64 Hermes compiler; this is not a native build workaround or a claim of compiled native code.

## Known scope limits

Optional downloadable dictionary packs and a general morphology/transliteration engine are not implemented. Translation uses an explicit subset editor rather than injecting an OS selection-menu action. Source text/citations must never be invented to hide absent books. Physical iOS/Android rendering/accessibility, native compilation, native SHA-256 execution, real inference, Cloud credentials and phone acceptance remain distinct from automated tests/prebuild.

Primary references consulted: official Expo SDK 58 source documentation for Router, SQLite, SecureStore, fonts, file system, dev client, build properties, APK/EAS profiles; installed llama.rn artifact installer/plugin/type declarations; Apple Xcode device/signing documentation. Direct Expo website fetches returned 403, so official `expo/expo` SDK-58 docs and installed declarations were used instead. Font OFL is bundled beside Noto Naskh Arabic.
