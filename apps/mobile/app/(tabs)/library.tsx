import React, { useEffect, useState } from "react";
import { Linking } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Card,
  Label,
  Button,
  Row,
  useCopy,
  errorText,
} from "../../src/ui";
import { getBooks, type Book } from "../../src/data/database";
export default function Library() {
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState("");
  const t = useCopy();
  useEffect(() => {
    getBooks()
      .then(setBooks)
      .catch((e) => setError(errorText(e)));
  }, []);
  return (
    <Screen
      title={t("The library", "المكتبة")}
      subtitle={t(
        "Original texts. Transparent provenance.",
        "نصوص أصلية. مصادر واضحة.",
      )}
    >
      <Label>{error}</Label>
      {[...new Set(books.map((b) => b.category))].map((category) => (
        <React.Fragment key={category}>
          <Label muted>
            {category.toUpperCase()} ·{" "}
            {books.filter((b) => b.category === category).length}
          </Label>
          {books
            .filter((b) => b.category === category)
            .map((b) => (
              <Card key={b.id}>
                <Label arabic size={27}>
                  {b.title}
                </Label>
                <Label>{b.author}</Label>
                <Label muted>
                  {b.entryCount.toLocaleString()}{" "}
                  {t("entries · available offline", "مادة · متاح دون اتصال")}
                </Label>
                <Label muted>{b.edition}</Label>
                <Label muted>{b.license}</Label>
                <Row>
                  <Button
                    title={t("Search this book", "البحث في الكتاب")}
                    onPress={() =>
                      router.push({
                        pathname: "/search",
                        params: { book: b.id },
                      })
                    }
                  />
                  <Button
                    subtle
                    title={t("Source & attribution", "المصدر والنسبة")}
                    onPress={() =>
                      Linking.openURL(b.source_url).catch((e) =>
                        setError(errorText(e)),
                      )
                    }
                  />
                </Row>
              </Card>
            ))}
        </React.Fragment>
      ))}
      <Card>
        <Label>{t("An honest collection", "مجموعة موثّقة")}</Label>
        <Label muted>
          {t(
            "Only imported and redistribution-compatible books appear here. Unverified works are not silently included. Consult SOURCE_MANIFEST.md for scope and limitations.",
            "نعرض فقط الكتب المستوردة ذات حقوق إعادة التوزيع المتوافقة. لا نضيف كتباً غير موثقة. راجع بيان المصادر للحدود.",
          )}
        </Label>
        <Label muted>
          {t(
            "Optional dictionary packs are not yet supported. The bundled library is fully offline.",
            "حزم المعاجم الإضافية غير مدعومة حالياً. المكتبة المرفقة تعمل دون اتصال.",
          )}
        </Label>
      </Card>
    </Screen>
  );
}
