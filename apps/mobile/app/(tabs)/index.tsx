import React, { useState, useEffect } from "react";
import { router } from "expo-router";
import { View, Pressable } from "react-native";
import {
  Screen,
  Card,
  Label,
  Button,
  Input,
  Row,
  useCopy,
  useTheme,
} from "../../src/ui";
import { getEntry, type Entry } from "../../src/data/database";
import { useApp } from "../../src/data/state";
export default function Home() {
  const t = useCopy();
  const c = useTheme();
  const s = useApp();
  const [q, setQ] = useState("");
  const [bookmarks, setBookmarks] = useState<Entry[]>([]);
  const [bookmarkError, setBookmarkError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all(s.bookmarks.slice(0, 3).map(getEntry))
      .then((rows) => {
        if (active) {
          setBookmarks(rows.filter((row): row is Entry => !!row));
          setBookmarkError("");
        }
      })
      .catch((error) => {
        if (active) setBookmarkError(String(error));
      });
    return () => {
      active = false;
    };
  }, [s.bookmarks]);
  const search = (v = q) =>
    router.push({ pathname: "/search", params: { q: v } });
  return (
    <Screen
      title="OpenRoots"
      subtitle={t(
        "Classical words. Original sources.",
        "كلمات أصيلة. مصادر موثّقة.",
      )}
    >
      <Card
        style={{
          backgroundColor: c.accentBg,
          borderColor: c.accentBg,
          padding: 24,
        }}
      >
        <Label muted size={12}>
          {t("YOUR ARABIC REFERENCE DESK", "مكتبك للبحث في العربية")}
        </Label>
        <Label arabic size={40}>
          لكلّ كلمةٍ جذور
        </Label>
        <Label>
          {t(
            "Explore the language through the words of its lexicographers.",
            "اكتشف اللغة من نصوص أهل المعاجم.",
          )}
        </Label>
        <Input
          value={q}
          onChangeText={setQ}
          placeholder={t(
            "Search a word, root, or English term",
            "ابحث عن كلمة أو جذر",
          )}
          onSubmitEditing={() => search()}
          returnKeyType="search"
        />
        <Button
          title={t("Search the dictionaries", "البحث في المعاجم")}
          onPress={() => search()}
        />
      </Card>
      <Row>
        {[
          ["Ask AI", "اسأل المساعد", "/ai"],
          ["Compare words", "قارن الكلمات", "/compare"],
          ["Translate", "ترجم", "/translate"],
        ].map(([en, ar, path]) => (
          <View key={path} style={{ flexGrow: 1 }}>
            <Button
              subtle
              title={t(en!, ar!)}
              onPress={() => router.push(path as "/ai")}
            />
          </View>
        ))}
      </Row>
      <Label muted>{t("A PLACE TO BEGIN", "بداية البحث")}</Label>
      <Row>
        {[
          "كتب",
          "علم",
          "رحمة",
          "صبر",
          "خوف",
          "خشية",
          "تقوى",
          "غفر",
          "هدى",
          "نور",
        ].map((word) => (
          <Pressable
            accessibilityRole="button"
            key={word}
            onPress={() => search(word)}
            style={{
              borderWidth: 1,
              borderColor: c.line,
              paddingHorizontal: 18,
              borderRadius: 30,
              backgroundColor: c.card,
            }}
          >
            <Label arabic size={23}>
              {word}
            </Label>
          </Pressable>
        ))}
      </Row>
      <Card>
        <Label>{t("Recently explored", "آخر عمليات البحث")}</Label>
        {s.history.length ? (
          s.history
            .slice(0, 5)
            .map((x) => (
              <Button key={x} subtle title={x} onPress={() => search(x)} />
            ))
        ) : (
          <Label muted>
            {t(
              "Your research trail stays on this device. Start with a word above.",
              "يبقى سجل بحثك على هذا الجهاز. ابدأ بكلمة أعلاه.",
            )}
          </Label>
        )}
      </Card>
      <Card>
        <Label>{t("Continue reading", "تابع القراءة")}</Label>
        {bookmarks.length ? (
          bookmarks.map((entry) => (
            <Button
              key={entry.id}
              subtle
              title={
                (entry.headword ||
                  t("Unheaded source entry", "مادة بلا عنوان")) +
                " · " +
                entry.bookTitle
              }
              onPress={() =>
                router.push({
                  pathname: "/entry/[id]",
                  params: { id: entry.id },
                })
              }
            />
          ))
        ) : (
          <Label muted>
            {t(
              "Bookmark a source entry to keep it close at hand.",
              "احفظ مادة أصلية للعودة إليها هنا.",
            )}
          </Label>
        )}
        {bookmarkError && <Label>{bookmarkError}</Label>}
        <Button
          subtle
          title={t("All saved research", "كل المحفوظات")}
          onPress={() => router.push("/saved")}
        />
      </Card>
      <Card>
        <Label>{t("Read first. Ask second.", "اقرأ المصدر أولاً.")}</Label>
        <Label muted>
          {t(
            "Offline dictionaries are the foundation. AI explanations cite retrieved passages; they are not a substitute for the originals.",
            "المعاجم دون اتصال هي الأساس. شروح الذكاء الاصطناعي مرتبطة بالنصوص المسترجعة ولا تغني عن الأصول.",
          )}
        </Label>
        <Button
          subtle
          title={t("Browse sources & licenses", "المصادر والتراخيص")}
          onPress={() => router.push("/library")}
        />
      </Card>
    </Screen>
  );
}
