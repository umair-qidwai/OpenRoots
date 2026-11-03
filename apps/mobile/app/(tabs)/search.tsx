import React, { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import {
  Screen,
  Card,
  Label,
  Button,
  Input,
  Row,
  Busy,
  useCopy,
  errorText,
} from "../../src/ui";
import {
  searchEntries,
  getBooks,
  type Entry,
  type Book,
} from "../../src/data/database";
import { transliterationCandidates } from "../../src/core/transliteration";
import { remember } from "../../src/data/state";
export default function SearchRoute() {
  const params = useLocalSearchParams<{ q?: string; book?: string }>();
  return (
    <Search
      key={(params.q ?? "") + "|" + (params.book ?? "")}
      initialQuery={params.q ?? ""}
      initialBook={params.book}
    />
  );
}
function Search({
  initialQuery,
  initialBook,
}: {
  initialQuery: string;
  initialBook?: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const [normalized, setNormalized] = useState(true);
  const [book, setBook] = useState(initialBook);
  const [books, setBooks] = useState<Book[]>([]);
  const [rows, setRows] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = useCopy();
  useEffect(() => {
    getBooks()
      .then(setBooks)
      .catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setBusy(true);
      searchEntries(q, normalized, book)
        .then((v) => {
          if (active) setRows(v);
        })
        .catch((e) => {
          if (active) setError(errorText(e));
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, normalized, book]);
  const open = async (e: Entry) => {
    await remember(q);
    router.push({ pathname: "/entry/[id]", params: { id: e.id } });
  };
  return (
    <Screen
      title={t("Dictionary", "المعجم")}
      subtitle={t(
        "Search real source text, offline. No inferred roots.",
        "ابحث في نصوص أصلية دون اتصال. لا جذور مستنتجة.",
      )}
    >
      <Input
        accessibilityLabel={t("Dictionary query", "نص البحث")}
        value={q}
        onChangeText={(v) => {
          setQ(v);
          setError("");
        }}
        placeholder={t("Arabic, root, or English…", "كلمة أو جذر…")}
        returnKeyType="search"
        onSubmitEditing={() => {
          if (q.trim()) remember(q);
        }}
      />
      <Row>
        <Button
          subtle
          title={
            normalized
              ? t("✓ Normalized", "✓ مُطبّع")
              : t("Original spelling", "الرسم الأصلي")
          }
          onPress={() => setNormalized(!normalized)}
        />
        <Button
          subtle
          title={t("All books", "كل الكتب") + (book ? "" : " ✓")}
          onPress={() => setBook(undefined)}
        />
        {books.map((b) => (
          <Button
            key={b.id}
            subtle
            title={(book === b.id ? "✓ " : "") + b.title}
            onPress={() => setBook(b.id)}
          />
        ))}
      </Row>
      {normalized && transliterationCandidates(q).length > 0 && (
        <Label muted>
          {t(
            "Spelling aid (not root extraction): ",
            "مساعدة إملائية (لا استخراج للجذر): ",
          ) + transliterationCandidates(q).join(" / ")}
        </Label>
      )}
      {busy ? (
        <Busy />
      ) : (
        <Label muted>
          {q
            ? `${rows.length}${rows.length === 60 ? "+" : ""} ${t("entries · tap to read the original", "مادة · افتح النص الأصلي")}`
            : t(
                "Enter a word to explore the collection.",
                "أدخل كلمة للبحث في المجموعة.",
              )}
        </Label>
      )}
      {error && <Label>{error}</Label>}
      {!busy && q && rows.length === 0 && (
        <Card>
          <Label>
            {t("No matching source entries", "لا توجد مواد مطابقة")}
          </Label>
          <Label muted>
            {t(
              "Try a source-attested root, fewer letters, or normalized search. No morphology is guessed.",
              "جرّب جذراً موثقاً أو أحرفاً أقل أو البحث المُطبّع. لا نستنتج الصرف.",
            )}
          </Label>
        </Card>
      )}
      {rows.map((e) => (
        <Card key={e.id}>
          <Row>
            <Label arabic size={30}>
              {e.headword || t("Unheaded source entry", "مادة بلا عنوان")}
            </Label>
            {e.root && (
              <Label muted>
                {t("Root", "الجذر")}: {e.root}
              </Label>
            )}
          </Row>
          <Label muted>{e.bookTitle}</Label>
          <Label arabic size={20}>
            {e.text.trim().slice(0, 190)}
            {e.text.length > 190 ? "…" : ""}
          </Label>
          <Button
            subtle
            title={t("Read full entry →", "قراءة المادة كاملة")}
            onPress={() => open(e)}
          />
        </Card>
      ))}
    </Screen>
  );
}
