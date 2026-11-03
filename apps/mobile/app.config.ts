import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "OpenRoots",
  slug: "openroots",
  scheme: "openroots",
  version: "1.0.0",
  icon: "./assets/brand/icon.png",
  orientation: "default",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier:
      process.env.OPENROOTS_IOS_BUNDLE_ID ?? "org.openroots.app",
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "org.openroots.app",
    permissions: ["INTERNET"],
    adaptiveIcon: {
      foregroundImage: "./assets/brand/adaptive.png",
      backgroundColor: "#245B40",
    },
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/brand/favicon.png",
  },
  plugins: [
    "expo-router",
    ["expo-sqlite", { enableFTS: true }],
    "expo-secure-store",
    "expo-font",
    "expo-dev-client",
    [
      "llama.rn",
      {
        // Optional eligible paid-team memory entitlements; off for free Xcode Personal Team signing.
        enableEntitlements: process.env.OPENROOTS_EXTENDED_MEMORY === "1",
        entitlementsProfile: "production",
        forceCxx20: true,
        enableOpenCLAndHexagon: false,
      },
    ],
    [
      "expo-build-properties",
      { ios: { deploymentTarget: "16.4" }, android: { minSdkVersion: 26 } },
    ],
  ],
  experiments: { typedRoutes: true },
};
export default config;
