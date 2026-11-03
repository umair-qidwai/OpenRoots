import React from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useApp } from "../../src/data/state";
import { useTheme, useCopy } from "../../src/ui";
export default function Layout() {
  const c = useTheme();
  const t = useCopy();
  const ar = useApp().settings.language === "ar";
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          backgroundColor: c.card,
          direction: ar ? "rtl" : "ltr",
          borderTopColor: c.line,
          height: 76,
          paddingBottom: 14,
          paddingTop: 9,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginHorizontal: 0,
        },
      }}
    >
      {(
        [
          ["index", t("Home", "الرئيسية"), "⌂"],
          ["search", t("Search", "المعجم"), "⌕"],
          ["library", t("Library", "المكتبة"), "▤"],
          ["saved", t("Saved", "محفوظات"), "◇"],
          ["ai", t("Ask AI", "المساعد"), "✧"],
          ["settings", t("Settings", "الإعدادات"), "⚙"],
        ] as const
      ).map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 24 }}>{icon}</Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
