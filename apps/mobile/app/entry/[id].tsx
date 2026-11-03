import React, { useEffect, useState, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, ScrollView, Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  Screen,
  Card,
  Label,
  Button,
  Input,
  Row,
  Busy,
  useCopy,
  useTheme,
  errorText,
  notify,
} from "../../src/ui";
import { readingDirection } from "../../src/core/text-direction";
import { getEntry, getPassages, type Entry } from "../../src/data/database";
import { bookmark, useApp, settings } from "../../src/data/state";
import type { SourcePassage } from "@openroots/shared";
export default function EntryScreen() {
  const { id, passage } = useLocalSearchParams<{
    id: string;
    passage?: string;
  }>();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [passages, setPassages] = useState<SourcePassage[]>([]);
  const [within, setWithin] = useState("");
  const [error, setError] = useState("");
  const scroll = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const app = useApp();
  const c = useTheme();
  const t = useCopy();
  useEffect(() => {
    Promise.all([getEntry(id), getPassages(id)])
      .then(([e, p]) => {
        setEntry(e);
        setPassages(p);
        if (!e) setError("Source entry not found.");
      })
      .catch((e) => setError(errorText(e)));
  }, [id]);
  if (!entry)
    return (
      <Screen title={t("Source entry", "المادة الأصلية")}>
        <Button
          subtle
          title={t("← Back", "رجوع")}
          onPress={() => router.back()}
        />
        {error ? <Label>{error}</Label> : <Busy />}
      </Screen>
    );
  const filtered = passages.filter((p) => !within || p.text.includes(within));
  return (
    <Screen
      scrollRef={scroll}
      title={entry.headword || t("Unheaded source entry", "مادة بلا عنوان")}
      subtitle={entry.bookTitle}
      action={<Button subtle title="←" onPress={() => router.back()} />}
    >
      <Row>
        <Button
          title={
            app.bookmarks.includes(id)
              ? t("Saved ✓", "محفوظ ✓")
              : t("Bookmark", "احفظ")
          }
          onPress={() =>
            bookmark(id).catch((e) => notify("Save failed", errorText(e)))
          }
        />
        <Button
          subtle
          title={t("Copy entry", "نسخ المادة")}
          onPress={() =>
            Clipboard.setStringAsync(entry.text).then(() =>
              notify(
                t("Copied", "تم النسخ"),
                t("Original text copied.", "تم نسخ النص الأصلي."),
              ),
            )
          }
        />
        <Button
          subtle
          title="A−"
          onPress={() =>
            settings({ fontSize: Math.max(18, app.settings.fontSize - 2) })
          }
        />
        <Button
          subtle
          title="A+"
          onPress={() =>
            settings({ fontSize: Math.min(38, app.settings.fontSize + 2) })
          }
        />
      </Row>
      <Card>
        <Label>{entry.author}</Label>
        {!entry.headword.trim() && (
          <Label muted>
            {t(
              "This digital-edition entry has no headword. Its original text can be read and saved, but is excluded from AI context rather than assigned an invented heading.",
              "هذه المادة بلا عنوان في النسخة الرقمية. يمكن قراءتها وحفظها، لكنها مستبعدة من سياق المساعد بدلاً من اختلاق عنوان.",
            )}
          </Label>
        )}
        {entry.root && (
          <Label>
            {t("Source root", "الجذر في المصدر")}: {entry.root}
          </Label>
        )}
        {entry.locator && <Label muted>{entry.locator}</Label>}
        <Label muted>{entry.license}</Label>
        <Button
          subtle
          title={t("Open original source ↗", "فتح المصدر الأصلي")}
          onPress={() =>
            Linking.openURL(entry.source_url).catch((e) =>
              notify("Source link", errorText(e)),
            )
          }
        />
      </Card>
      <Input
        value={within}
        onChangeText={setWithin}
        placeholder={t("Find in original entry…", "ابحث في المادة الأصلية…")}
      />
      {within && (
        <Label muted>
          {filtered.length} {t("matching passages", "مقاطع مطابقة")}
        </Label>
      )}
      {filtered.map((p) => (
        <Card
          key={p.id}
          onLayout={(event) => {
            if (p.id === passage) {
              const y = event.nativeEvent.layout.y;
              setTimeout(
                () =>
                  scroll.current?.scrollTo({
                    y: Math.max(0, y - 12),
                    animated: true,
                  }),
                300,
              );
            }
          }}
          style={
            p.id === passage
              ? {
                  borderColor: c.accent,
                  borderWidth: 2,
                  backgroundColor: c.accentBg,
                }
              : undefined
          }
        >
          <Label muted size={12}>
            {t("ORIGINAL SOURCE ·", "النص الأصلي ·")} {p.id.slice(-10)}
          </Label>
          <Text
            selectable
            style={{
              fontFamily: "NotoNaskh",
              fontSize: app.settings.fontSize,
              lineHeight: app.settings.fontSize * 1.95,
              writingDirection: readingDirection(p.text),
              textAlign: readingDirection(p.text) === "rtl" ? "right" : "left",
              color: c.text,
            }}
          >
            {within
              ? p.text.split(within).map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && (
                      <Text
                        style={{ backgroundColor: c.accentBg, color: c.accent }}
                      >
                        {within}
                      </Text>
                    )}
                    {part}
                  </React.Fragment>
                ))
              : p.text}
          </Text>
          <Row>
            <Button
              subtle
              title={t("Translate this passage", "ترجمة هذا المقطع")}
              disabled={!p.headword.trim()}
              onPress={() =>
                router.push({
                  pathname: "/translate",
                  params: { entry: id, passage: p.id },
                })
              }
            />
            <Button
              subtle
              title={t("Copy", "نسخ")}
              onPress={() => Clipboard.setStringAsync(p.text)}
            />
          </Row>
        </Card>
      ))}
      {error && <Label>{error}</Label>}
    </Screen>
  );
}
