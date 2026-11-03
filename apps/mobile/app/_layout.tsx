import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initializeDictionary } from "../src/data/database";
import { initializeServices } from "../src/core/initialize";
import { initializeState } from "../src/data/state";
import { Screen, Label, Button, Busy, useTheme, errorText } from "../src/ui";
function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [font, fontError] = useFonts({
    NotoNaskh: require("../assets/fonts/NotoNaskhArabic.ttf"),
  });
  const c = useTheme();
  const init = () => {
    initializeServices(initializeDictionary, initializeState)
      .then(() => {
        setError("");
        setReady(true);
      })
      .catch((e) => setError(errorText(e)));
  };
  useEffect(init, []);
  if (error || fontError)
    return (
      <Screen title="OpenRoots">
        <Label>{error || String(fontError)}</Label>
        <Button title="Retry initialization" onPress={init} />
      </Screen>
    );
  if (!ready || !font)
    return (
      <Screen title="OpenRoots" subtitle="Opening your reference library">
        <Busy />
      </Screen>
    );
  return (
    <>
      <StatusBar style={c.bg === "#141D19" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="entry/[id]" />
        <Stack.Screen name="compare" />
        <Stack.Screen name="translate" />
      </Stack>
    </>
  );
}
export default function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}
