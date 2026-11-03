import React from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  useColorScheme,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { readingDirection } from "./core/text-direction";
import { useApp } from "./data/state";
export function useTheme() {
  const { settings } = useApp();
  const system = useColorScheme();
  const dark =
    settings.theme === "dark" ||
    (settings.theme === "system" && system === "dark");
  return dark
    ? {
        bg: "#141D19",
        card: "#1D2923",
        text: "#F3EDDE",
        muted: "#B3C1B7",
        line: "#35443B",
        accent: "#A9D6B5",
        accentBg: "#294637",
        soft: "#222F28",
      }
    : {
        bg: "#F8F5ED",
        card: "#FFFEF9",
        text: "#24342B",
        muted: "#68786C",
        line: "#E0E4D8",
        accent: "#245B40",
        accentBg: "#E8F0E5",
        soft: "#EFEDE3",
      };
}
export function useCopy() {
  const ar = useApp().settings.language === "ar";
  return (en: string, arabic: string) => (ar ? arabic : en);
}
export function Screen({
  children,
  title,
  subtitle,
  action,
  scrollRef,
}: React.PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  scrollRef?: React.RefObject<React.ComponentRef<typeof ScrollView> | null>;
}>) {
  const c = useTheme();
  const ar = useApp().settings.language === "ar";
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: c.bg }}
    >
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 40,
          gap: 20,
          width: "100%",
          maxWidth: 820,
          alignSelf: "center",
        }}
      >
        <View
          style={{
            flexDirection: ar ? "row-reverse" : "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              accessibilityRole="header"
              style={{
                color: c.text,
                fontSize: 32,
                fontWeight: "600",
                letterSpacing: -0.7,
                textAlign: ar ? "right" : "left",
              }}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                style={{
                  color: c.muted,
                  fontSize: 14,
                  lineHeight: 22,
                  marginTop: 6,
                  textAlign: ar ? "right" : "left",
                }}
              >
                {subtitle}
              </Text>
            )}
          </View>
          {action}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Card({
  children,
  style,
  onLayout,
}: React.PropsWithChildren<{
  style?: object;
  onLayout?: React.ComponentProps<typeof View>["onLayout"];
}>) {
  const c = useTheme();
  return (
    <View
      onLayout={onLayout}
      style={[
        {
          backgroundColor: c.card,
          borderColor: c.line,
          borderWidth: 1,
          borderRadius: 20,
          padding: 20,
          gap: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Label({
  children,
  muted = false,
  arabic = false,
  size,
}: React.PropsWithChildren<{
  muted?: boolean;
  arabic?: boolean;
  size?: number;
}>) {
  const c = useTheme();
  const { settings } = useApp();
  const text = React.Children.toArray(children)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : "",
    )
    .join("");
  const direction = readingDirection(text);
  return (
    <Text
      selectable
      style={{
        color: muted ? c.muted : c.text,
        fontSize: size ?? (arabic ? settings.fontSize : 16),
        lineHeight: arabic ? (size ?? settings.fontSize) * 1.9 : 24,
        fontFamily: arabic ? "NotoNaskh" : undefined,
        writingDirection: direction,
        textAlign: arabic
          ? direction === "rtl"
            ? "right"
            : "left"
          : settings.language === "ar"
            ? "right"
            : "left",
      }}
    >
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  subtle = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  subtle?: boolean;
  disabled?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 46,
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 12,
        backgroundColor: subtle ? c.accentBg : c.accent,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: subtle ? c.accent : c.bg,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Input(props: React.ComponentProps<typeof TextInput>) {
  const c = useTheme();
  return (
    <TextInput
      placeholderTextColor={c.muted}
      {...props}
      style={[
        {
          minHeight: 52,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: 13,
          paddingHorizontal: 16,
          paddingVertical: 12,
          fontSize: 16,
          color: c.text,
          backgroundColor: c.card,
        },
        props.style,
      ]}
    />
  );
}
export function Row({ children }: React.PropsWithChildren) {
  const ar = useApp().settings.language === "ar";
  return (
    <View
      style={{
        flexDirection: ar ? "row-reverse" : "row",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {children}
    </View>
  );
}
export function Busy() {
  const c = useTheme();
  return <ActivityIndicator color={c.accent} style={{ padding: 20 }} />;
}
export function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
export function notify(title: string, message: string) {
  if (Platform.OS === "web") window.alert(title + "\n" + message);
  else Alert.alert(title, message);
}
export const styles = StyleSheet.create({});
