import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import { Screen, Card, Label, Button, Row, useCopy } from "../../src/ui";
import { useApp, bookmark } from "../../src/data/state";
import { getEntry, type Entry } from "../../src/data/database";
import { AnswerCard } from "../../src/components/AnswerCard";
export default function Saved() {
  const s = useApp();
  const t = useCopy();
  const [tab, setTab] = useState("bookmarks");
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => {
    Promise.all(s.bookmarks.map(getEntry)).then((v) =>
      setEntries(v.filter((x): x is Entry => !!x)),
    );
  }, [s.bookmarks]);
  return (
    <Screen
      title={t("Saved research", "المحفوظات")}
      subtitle={t(
        "Kept privately, on this device.",
        "محفوظة بخصوصية على هذا الجهاز.",
      )}
    >
      <Row>
        {[
          ["bookmarks", "Bookmarks", "المواد"],
          ["answers", "Explanations", "الشروح"],
          ["history", "History", "السجل"],
        ].map(([id, en, ar]) => (
          <Button
            key={id}
            subtle
            title={(tab === id ? "✓ " : "") + t(en!, ar!)}
            onPress={() => setTab(id!)}
          />
        ))}
      </Row>
      {tab === "bookmarks" &&
        (entries.length ? (
          entries.map((e) => (
            <Card key={e.id}>
              <Label arabic>
                {e.headword || t("Unheaded source entry", "مادة بلا عنوان")}
              </Label>
              <Label muted>{e.bookTitle}</Label>
              <Row>
                <Button
                  title={t("Read", "اقرأ")}
                  onPress={() =>
                    router.push({
                      pathname: "/entry/[id]",
                      params: { id: e.id },
                    })
                  }
                />
                <Button
                  subtle
                  title={t("Remove", "حذف")}
                  onPress={() => bookmark(e.id)}
                />
              </Row>
            </Card>
          ))
        ) : (
          <Card>
            <Label muted>
              {t(
                "Bookmark a source entry to return to it here.",
                "احفظ مادة من المعجم للعودة إليها هنا.",
              )}
            </Label>
          </Card>
        ))}
      {tab === "answers" &&
        (s.saved.length ? (
          s.saved.map((m) => <AnswerCard key={m.id} message={m} />)
        ) : (
          <Card>
            <Label muted>
              {t(
                "Saved AI explanations and translations appear here.",
                "ستظهر هنا شروح وترجمات الذكاء الاصطناعي المحفوظة.",
              )}
            </Label>
          </Card>
        ))}
      {tab === "history" &&
        s.history.map((q) => (
          <Button
            key={q}
            subtle
            title={q}
            onPress={() => router.push({ pathname: "/search", params: { q } })}
          />
        ))}
    </Screen>
  );
}
