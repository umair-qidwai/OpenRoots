# Install OpenRoots on your phones

Use your **Mac for both phones**. Neither app needs to be published to an app store. These steps build your private test copies; the source has automated/browser verification, not a completed physical-device test.

## 1. Set up the Mac once

Install:

- **Xcode** from the Mac App Store. Open it once and finish its setup prompts.
- **Node.js 24**. Check Terminal with `node --version`.
- **CocoaPods** for iOS. If you already use Homebrew, `brew install cocoapods`. Otherwise Expo can offer installation during prebuild; finish that successfully before continuing.
- **Android Studio** only when you reach the OnePlus steps below.

Open Terminal and run:

```sh
git clone https://github.com/umair-qidwai/OpenRoots.git
cd OpenRoots
npm ci
```

Wait for this to finish. It installs dependencies/native inference libraries and automatically restores/checks the real bundled dictionary from its compressed Git asset. **Do not use `--ignore-scripts` for a phone build.** The optional 2.5 GB AI model is downloaded later on the phone, not here.

## 2. iPhone first — free Xcode signing

1. In Xcode, open **Settings → Accounts** and add your Apple Account.
2. Connect the iPhone by USB, unlock it, and accept **Trust This Computer**.
3. In Terminal, from the `OpenRoots` folder:

```sh
cd apps/mobile
export OPENROOTS_IOS_BUNDLE_ID=org.openroots.umair
npx expo prebuild --platform ios
open ios/OpenRoots.xcworkspace
```

4. In Xcode's left sidebar select the **OpenRoots project**, then the **OpenRoots app target**.
5. Open **Signing & Capabilities**. Turn on **Automatically manage signing** and choose your **Personal Team**.
6. At the top of Xcode, select your connected iPhone as the destination.
7. Choose **Product → Scheme → Edit Scheme → Run → Info** and set **Build Configuration = Release**. This makes a standalone app that does not need your computer's development server.
8. Press Xcode's **▶ Run** button. Follow any iPhone **Developer Mode** or developer-trust prompts, then open OpenRoots.

**Free Apple signing expires after 7 days.** Reconnect and rebuild with the same Team and Bundle Identifier to renew it. Do not delete the app just to renew signing; deleting it loses its private saved data/model. A paid Apple membership/TestFlight is not required for this direct personal-test route.

If the build fails, send the **first red error in Xcode**, not just “build failed.” Never send an Apple password, certificate private key or verification code in chat.

## 3. OnePlus — use the same Mac, build/install locally

1. Install/open **Android Studio** and finish its standard setup wizard/Android SDK installation. Accept requested SDK licenses.
2. On the OnePlus, enable **Developer options → USB debugging**. Connect USB and accept the computer authorization prompt.
3. In a new Terminal window:

```sh
cd OpenRoots/apps/mobile
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
adb devices
```

If your clone is somewhere else, use that folder's full path instead of `OpenRoots/apps/mobile`. `adb devices` must show your phone as **device**, not **unauthorized**.

4. Build and install:

```sh
npx expo run:android --device --variant release
```

Select your OnePlus if prompted. Wait for compilation/installation, then open OpenRoots. The Release app includes its JavaScript and does not need Metro running.

### Keep an APK file for later installation

The generated project can also produce the APK directly:

```sh
cd android
./gradlew :app:assembleRelease
```

File location, relative to the repository:

```text
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Transfer that file to your OnePlus and tap it to install; allow **Install unknown apps** for your trusted file app if prompted. Or use USB:

```sh
adb install -r /full/path/to/app-release.apk
```

For these local private builds, Expo's generated project uses its test/debug signing configuration. Keep the generated Android project/keystore if you want to update the same installation without losing its data. This is not a production-store signing setup. If signatures differ, do not uninstall blindly: that removes saved data and the downloaded model.

This local route needs neither a Google Play developer account nor an Expo cloud-build subscription. If you prefer a cloud-built APK instead, see the optional EAS route in `docs/MOBILE.md`; its account/build allowances and project linking are separate setup steps.

## 4. First test on each phone

1. **No AI setup needed:** search `صبر`, `خوف`, `خشية`; open/copy/bookmark an entry. Quit and reopen to check that saved data persists.
2. Switch to airplane mode and search again. The bundled dictionary should work independently of AI.
3. For Local AI, reconnect, open **Settings → On-device model**, download/verify the model, tap **Load**, then choose **Local** in Assistant.
4. Ask about `صبر`, compare `خوف` and `خشية`, and tap a citation to open the original passage. Then test Local in airplane mode.
5. Cloud AI is optional and needs your separately configured Worker HTTPS URL and personal access token. Never put a Cloudflare account API token in the app.

The current bundled work is Lane's verified digital edition. Other editions are not silently replaced with generated definitions. Model performance/RAM/heat and actual offline inference still need checking on your phones.

## Updating from GitHub later

From the repository root:

```sh
git pull
npm ci
```

Then rebuild through Xcode/Android as above. Keep the same Apple Bundle Identifier and Android signing key for updates. Avoid rerunning `prebuild --clean` after manually setting up local signing unless you are prepared to restore those settings.

Official references: Apple's Personal Team/account guide (`developer.apple.com/support/compare-memberships/`), Expo local development (`docs.expo.dev/guides/local-app-development/`) and APK installation (`docs.expo.dev/build-reference/apk/`). More detail and acceptance checks: `docs/MOBILE.md` and `docs/VERIFICATION.md`.
