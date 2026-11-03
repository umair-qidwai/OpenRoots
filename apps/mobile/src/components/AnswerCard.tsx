import React from "react";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Card, Label, Button, Row, useCopy } from "../ui";
import { saveMessage, type Message, useApp } from "../data/state";
export function AnswerCard({ message }: { message: Message }) {
  const t = useCopy();
  const saved = useApp().saved.some((m) => m.id === message.id);
  const text = message.answer.sections
    .map((s) => s.title + "\n" + s.text)
    .join("\n\n");
  return (
    <Card>
      <Label>{message.question}</Label>
      <Label muted size={12}>
        {t("AI-GENERATED ·", "نص مولّد آلياً ·")}{" "}
        {message.answer.provider.toUpperCase()} · {message.answer.model}
      </Label>
      {message.original && (
        <Label arabic size={22}>
          {message.original}
        </Label>
      )}
      {message.answer.insufficientEvidence && (
        <Label>
          {t(
            "The retrieved sources may be insufficient. Do not treat this as an authoritative conclusion.",
            "قد لا تكفي المصادر المسترجعة. لا تعدّ هذه النتيجة حكماً موثقاً.",
          )}
        </Label>
      )}
      {message.answer.sections.map((section, i) => (
        <React.Fragment key={i}>
          <Label size={19}>{section.title}</Label>
          <Label>{section.text}</Label>
          <Row>
            {section.citations.map((id) => {
              const p = message.passages.find((p) => p.id === id);
              return p ? (
                <Button
                  key={id}
                  subtle
                  title={p.bookTitle + " · " + p.headword}
                  onPress={() =>
                    router.push({
                      pathname: "/entry/[id]",
                      params: { id: p.entryId, passage: p.id },
                    })
                  }
                />
              ) : null;
            })}
          </Row>
        </React.Fragment>
      ))}
      <Row>
        <Button
          subtle
          title={
            saved
              ? t("Saved ✓", "محفوظ ✓")
              : t("Save explanation", "احفظ الشرح")
          }
          onPress={() => saveMessage(message)}
        />
        <Button
          subtle
          title={t("Copy answer", "نسخ الجواب")}
          onPress={() => Clipboard.setStringAsync(text)}
        />
      </Row>
    </Card>
  );
}
