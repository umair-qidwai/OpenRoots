import React, { useState, useRef, useEffect } from "react";
import type { SourcePassage, AIOptions } from "@openroots/shared";
import { router } from "expo-router";
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
} from "../ui";
import { CloudflareAIProvider } from "../ai/cloud";
import { LocalAIProvider } from "../ai/local";
import { modelManager, LOCAL_MODEL } from "../ai/models";
import { retrieve, getPassages } from "../data/database";
import {
  useApp,
  settings,
  addMessage,
  clearConversation,
  type Message,
} from "../data/state";
import { compactPassages, conversationContext } from "../core/ai-context";
import { selectTranslation } from "../core/search";
import { AnswerCard } from "./AnswerCard";
export function Research({
  task = "explain",
  entryId,
  passageId,
}: {
  task?: "explain" | "compare" | "translate";
  entryId?: string;
  passageId?: string;
}) {
  const app = useApp();
  const t = useCopy();
  const [question, setQuestion] = useState("");
  const [second, setSecond] = useState("");
  const [original, setOriginal] = useState<SourcePassage | null>(null);
  const [selection, setSelection] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState<Message | null>(null);
  const [local, setLocal] = useState(modelManager.getState());
  const abort = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  useEffect(() => modelManager.subscribe(setLocal), []);
  useEffect(() => {
    if (entryId)
      getPassages(entryId)
        .then((p) => {
          const source = p.find((x) => x.id === passageId) ?? p[0];
          if (source) {
            setOriginal(source);
            setSelection(source.text.slice(0, 6000));
          }
        })
        .catch((e) => setError(errorText(e)));
  }, [entryId, passageId]);
  useEffect(() => () => abort.current?.abort(), []);
  const submit = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setBusy(true);
    abort.current = new AbortController();
    try {
      let q =
        task === "compare"
          ? `Compare ${question} and ${second}. Distinguish only meanings supported by the supplied sources.`
          : question;
      let passages: SourcePassage[];
      let text: string | undefined;
      if (task === "translate") {
        if (!original)
          throw new Error(
            t(
              "Open a dictionary passage and choose Translate. Translation always retains its source.",
              "افتح مقطعاً من المعجم واختر الترجمة للاحتفاظ بالمصدر.",
            ),
          );
        text = selectTranslation(original.text, selection);
        q =
          "Translate the following exact source selection into natural English. Preserve uncertainty and explain only evidence in the source. Translate only the supplied selected passage.";
        passages = [{ ...original, text }];
      } else {
        if (!question.trim() || (task === "compare" && !second.trim()))
          throw new Error(
            t(
              "Enter the words or question first.",
              "أدخل الكلمات أو السؤال أولاً.",
            ),
          );
        passages = compactPassages(await retrieve(q), app.settings.provider);
      }
      if (!passages.length)
        throw new Error(
          t(
            "No source passages found. Try a source-attested word or root. Nothing will be invented.",
            "لم نجد نصوصاً مناسبة. جرّب كلمة أو جذراً موثقاً؛ لن نختلق مصدراً.",
          ),
        );
      const opts: AIOptions = {
        task,
        mode: app.settings.detailed ? "detailed" : "concise",
        signal: abort.current.signal,
        history: conversationContext(app.messages, app.settings.provider),
      };
      let answer;
      try {
        answer = await (
          app.settings.provider === "local"
            ? new LocalAIProvider()
            : new CloudflareAIProvider(
                app.settings.endpoint,
                app.settings.cloudModel,
              )
        ).generate(q, passages, opts);
      } catch (e) {
        if (
          app.settings.provider === "cloud" &&
          app.settings.fallback &&
          modelManager.getState().status === "loaded" &&
          !abort.current.signal.aborted
        ) {
          passages =
            task === "translate"
              ? passages
              : compactPassages(passages, "local");
          if (!passages.length)
            throw new Error(
              "No complete source passage fits the local context. Open a shorter passage or choose Cloud.",
            );
          answer = await new LocalAIProvider().generate(q, passages, {
            ...opts,
            history: conversationContext(app.messages, "local"),
          });
        } else throw e;
      }
      const message: Message = {
        id: Date.now().toString(36),
        at: Date.now(),
        question:
          task === "translate"
            ? t("Translation of ", "ترجمة ") + original!.headword
            : q,
        answer,
        passages,
        original: text,
      };
      await addMessage(message);
      setLast(message);
      if (task === "explain") setQuestion("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Screen
      title={
        task === "compare"
          ? t("Compare words", "قارن الكلمات")
          : task === "translate"
            ? t("Translate a passage", "ترجمة مقطع")
            : t("Research assistant", "المساعد البحثي")
      }
      subtitle={t(
        "Source-grounded explanations, not invented authority.",
        "شروح مرتبطة بالمصادر، لا مراجع مختلقة.",
      )}
      action={
        task !== "explain" ? (
          <Button subtle title="←" onPress={() => router.back()} />
        ) : undefined
      }
    >
      <Row>
        <Button
          title={
            app.settings.provider === "cloud"
              ? t("Cloud ✓", "سحابي ✓")
              : t("Cloud", "سحابي")
          }
          subtle={app.settings.provider !== "cloud"}
          onPress={() => settings({ provider: "cloud" })}
        />
        <Button
          title={
            app.settings.provider === "local"
              ? t("Local ✓", "محلي ✓")
              : t("Local", "محلي")
          }
          subtle={app.settings.provider !== "local"}
          onPress={() => settings({ provider: "local" })}
        />
        <Button
          subtle
          title={
            app.settings.detailed
              ? t("Detailed", "مفصّل")
              : t("Concise", "موجز")
          }
          onPress={() => settings({ detailed: !app.settings.detailed })}
        />
      </Row>
      <Label muted size={12}>
        {app.settings.provider === "cloud"
          ? t("Internet required · ", "يتطلب الإنترنت · ") +
            app.settings.cloudModel
          : LOCAL_MODEL.name + " · " + local.status}
      </Label>
      {task === "translate" ? (
        <>
          {original ? (
            <Card>
              <Label>
                {original.bookTitle} · {original.headword}
              </Label>
              <Label arabic size={22}>
                {original.text}
              </Label>
              <Label muted>
                {t(
                  "Explicit subset editor: retain only the exact words you want translated. The selection must occur verbatim in this passage.",
                  "حرّر المقطع لتبقي الكلمات المطلوبة حرفياً فقط. يجب أن تكون جزءاً مطابقاً للنص الأصلي.",
                )}
              </Label>
              <Input
                multiline
                value={selection}
                onChangeText={setSelection}
                style={{
                  fontFamily: "NotoNaskh",
                  fontSize: 23,
                  textAlign: "right",
                  minHeight: 150,
                }}
              />
            </Card>
          ) : (
            <Card>
              <Label>
                {t("Choose a source passage first", "اختر مقطعاً موثقاً أولاً")}
              </Label>
              <Label muted>
                {t(
                  "Search a dictionary, open an entry, then tap Translate this passage. Long entries are translated one explicit selection at a time.",
                  "ابحث في المعجم وافتح مادة ثم اختر ترجمة هذا المقطع. تُترجم النصوص الطويلة مقطعاً محدداً في كل مرة.",
                )}
              </Label>
              <Button
                title={t("Find a passage", "البحث عن مقطع")}
                onPress={() => router.push("/search")}
              />
            </Card>
          )}
        </>
      ) : (
        <Card>
          <Input
            multiline
            value={question}
            onChangeText={setQuestion}
            placeholder={
              task === "compare"
                ? t("First word, e.g. خوف", "الكلمة الأولى، مثلاً خوف")
                : t(
                    "Ask about an Arabic word or passage…",
                    "اسأل عن كلمة عربية أو مقطع…",
                  )
            }
            style={{ minHeight: 90 }}
          />
          {task === "compare" && (
            <Input
              value={second}
              onChangeText={setSecond}
              placeholder={t(
                "Second word, e.g. خشية",
                "الكلمة الثانية، مثلاً خشية",
              )}
            />
          )}
          <Label muted>
            {t(
              "Roots and morphology are reported only when supported by the retrieved source.",
              "لا نذكر الجذور والصرف إلا إذا دعمها المصدر المسترجع.",
            )}
          </Label>
        </Card>
      )}
      <Row>
        <Button
          title={
            busy
              ? t("Working…", "جارٍ البحث…")
              : task === "translate"
                ? t("Translate selection", "ترجمة المحدد")
                : task === "compare"
                  ? t("Compare with sources", "المقارنة بالمصادر")
                  : t("Ask with sources", "اسأل بالمصادر")
          }
          disabled={busy || (task === "translate" && !original)}
          onPress={submit}
        />
        {busy && (
          <Button
            subtle
            title={t("Cancel", "إلغاء")}
            onPress={() => abort.current?.abort()}
          />
        )}
      </Row>
      {busy && <Busy />}
      {error && (
        <Card>
          <Label>{error}</Label>
          <Row>
            <Button
              subtle
              title={t("Retry", "أعد المحاولة")}
              onPress={submit}
            />
            <Button
              subtle
              title={t("AI settings", "إعدادات المساعد")}
              onPress={() => router.push("/settings")}
            />
          </Row>
        </Card>
      )}
      {task === "explain" ? (
        <>
          {app.messages
            .slice()
            .reverse()
            .map((m) => (
              <AnswerCard key={m.id} message={m} />
            ))}
          {app.messages.length > 0 && (
            <Button
              subtle
              title={t("Clear conversation", "مسح المحادثة")}
              onPress={() => clearConversation()}
            />
          )}
        </>
      ) : (
        last && <AnswerCard message={last} />
      )}
    </Screen>
  );
}
