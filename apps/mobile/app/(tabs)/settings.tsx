import React, { useEffect, useState } from "react";
import { View, Switch, Alert, Platform } from "react-native";
import {
  Screen,
  Card,
  Label,
  Button,
  Input,
  Row,
  useCopy,
  errorText,
  notify,
  useTheme,
} from "../../src/ui";
import { useApp, settings, clearSaved } from "../../src/data/state";
import { setAccessToken, CloudflareAIProvider } from "../../src/ai/cloud";
import { modelManager, LOCAL_MODEL } from "../../src/ai/models";
import { safeEndpoint } from "../../src/core/search";
export default function Settings() {
  const app = useApp();
  const t = useCopy();
  const c = useTheme();
  const [endpoint, setEndpoint] = useState(app.settings.endpoint);
  const [token, setToken] = useState("");
  const [state, setState] = useState(modelManager.getState());
  const [storage, setStorage] = useState<{
    free: number;
    total: number;
  } | null>(null);
  const [models, setModels] = useState<{ id: string; available: boolean }[]>(
    [],
  );
  const [error, setError] = useState("");
  useEffect(() => modelManager.subscribe(setState), []);
  const action = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    }
  };
  const confirm = (title: string, fn: () => Promise<unknown>) => {
    if (Platform.OS === "web") {
      if (window.confirm(title)) action(fn);
    } else
      Alert.alert(title, t("This cannot be undone.", "لا يمكن التراجع."), [
        { text: t("Cancel", "إلغاء"), style: "cancel" },
        {
          text: t("Confirm", "تأكيد"),
          style: "destructive",
          onPress: () => action(fn),
        },
      ]);
  };
  return (
    <Screen
      title={t("Settings", "الإعدادات")}
      subtitle={t("Your library, your choices.", "مكتبتك، خياراتك.")}
    >
      <Card>
        <Label>{t("Reading & appearance", "القراءة والمظهر")}</Label>
        <Row>
          <Button
            subtle
            title={"English" + (app.settings.language === "en" ? " ✓" : "")}
            onPress={() => settings({ language: "en" })}
          />
          <Button
            subtle
            title={"العربية" + (app.settings.language === "ar" ? " ✓" : "")}
            onPress={() => settings({ language: "ar" })}
          />
        </Row>
        <Row>
          {(["system", "light", "dark"] as const).map((theme, i) => (
            <Button
              key={theme}
              subtle
              title={
                (app.settings.theme === theme ? "✓ " : "") +
                [t("System", "النظام"), t("Light", "فاتح"), t("Dark", "داكن")][
                  i
                ]
              }
              onPress={() => settings({ theme })}
            />
          ))}
        </Row>
        <Row>
          <Button
            subtle
            title="A−"
            onPress={() =>
              settings({ fontSize: Math.max(18, app.settings.fontSize - 2) })
            }
          />
          <Label>{app.settings.fontSize} pt</Label>
          <Button
            subtle
            title="A+"
            onPress={() =>
              settings({ fontSize: Math.min(38, app.settings.fontSize + 2) })
            }
          />
        </Row>
        <Label arabic>نورُ العلمِ في أصولِ الكلمات</Label>
      </Card>
      <Card>
        <Label>{t("AI provider", "مزوّد الذكاء الاصطناعي")}</Label>
        <Row>
          {(["cloud", "local"] as const).map((provider) => (
            <Button
              key={provider}
              subtle
              title={
                (app.settings.provider === provider ? "✓ " : "") +
                (provider === "cloud"
                  ? t("Cloud", "سحابي")
                  : t("Local", "محلي"))
              }
              onPress={() => settings({ provider })}
            />
          ))}
        </Row>
        <Label muted>
          {t(
            "Switching providers preserves conversation history. Cloud sends only the current question, selected source context, and recent conversation to your configured Worker.",
            "تغيير المزوّد يحفظ المحادثة. يرسل السحابي السؤال والنصوص المختارة والمحادثة الحديثة فقط إلى خادمك.",
          )}
        </Label>
        <Row>
          <Switch
            value={app.settings.fallback}
            onValueChange={(v) => settings({ fallback: v })}
            trackColor={{ true: c.accent }}
          />
          <View style={{ flex: 1 }}>
            <Label>
              {t(
                "Fallback to installed Local AI",
                "التحويل إلى النموذج المحلي المثبّت",
              )}
            </Label>
            <Label muted>
              {t(
                "Only when already loaded; never uploads Local questions.",
                "فقط إذا كان محمّلاً؛ لا يرسل الأسئلة المحلية للشبكة.",
              )}
            </Label>
          </View>
        </Row>
      </Card>
      <Card>
        <Label>{t("Cloud connection", "الاتصال السحابي")}</Label>
        <Input
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={endpoint}
          onChangeText={setEndpoint}
          placeholder="https://your-worker.workers.dev"
        />
        <Input
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={token}
          onChangeText={setToken}
          placeholder={t(
            "Worker access token (stored securely)",
            "رمز الوصول (يُخزّن بأمان)",
          )}
        />
        <Button
          title={t("Save connection", "حفظ الاتصال")}
          onPress={() =>
            action(async () => {
              const url = safeEndpoint(endpoint);
              if (token) await setAccessToken(token.trim());
              await settings({ endpoint: url });
              setToken("");
              notify(
                t("Saved", "تم الحفظ"),
                t("Connection settings saved.", "تم حفظ إعدادات الاتصال."),
              );
            })
          }
        />
        <Button
          subtle
          title={t("Check available models", "فحص النماذج المتاحة")}
          onPress={() =>
            action(async () =>
              setModels(
                await new CloudflareAIProvider(
                  app.settings.endpoint,
                  app.settings.cloudModel,
                ).models(),
              ),
            )
          }
        />
        {models.map((m) => (
          <Button
            key={m.id}
            subtle
            disabled={!m.available}
            title={
              (app.settings.cloudModel === m.id ? "✓ " : "") +
              m.id +
              (m.available ? "" : t(" · unavailable", " · غير متاح"))
            }
            onPress={() => settings({ cloudModel: m.id })}
          />
        ))}
        <Label muted>
          {t("Current: ", "الحالي: ") + app.settings.cloudModel}
        </Label>
        <Button
          subtle
          title={t("Remove access token", "حذف رمز الوصول")}
          onPress={() =>
            confirm(t("Remove access token?", "حذف رمز الوصول؟"), () =>
              setAccessToken(""),
            )
          }
        />
      </Card>
      <Card>
        <Label>{t("On-device model", "النموذج على الجهاز")}</Label>
        <Label>{LOCAL_MODEL.name}</Label>
        <Label muted>
          {(LOCAL_MODEL.size / 1e9).toFixed(2)} GB · {LOCAL_MODEL.license}
        </Label>
        <Label muted>
          {t(
            "Physical iOS / Android native build required. Download separately over a trusted connection; several GB of free storage and memory are needed.",
            "يتطلب جهاز iOS أو Android وبناءً أصلياً. التنزيل منفصل ويتطلب مساحة وذاكرة كافيتين.",
          )}
        </Label>
        <Label>
          {state.status} · {Math.round(state.progress * 100)}%
        </Label>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(state.progress * 100),
          }}
          style={{ height: 6, borderRadius: 4, backgroundColor: c.line }}
        >
          <View
            style={{
              height: 6,
              borderRadius: 4,
              width: `${Math.round(state.progress * 100)}%`,
              backgroundColor: c.accent,
            }}
          />
        </View>
        {state.warning && <Label>{state.warning}</Label>}
        {state.acceleration && <Label muted>{state.acceleration}</Label>}
        {state.error && <Label>{state.error}</Label>}
        <Row>
          <Button
            title={
              state.status === "paused"
                ? t("Resume", "استئناف")
                : t("Download / verify", "تنزيل / تحقق")
            }
            onPress={() => action(() => modelManager.download())}
            disabled={
              state.status === "downloading" ||
              state.status === "verifying" ||
              state.status === "loaded" ||
              state.status === "loading"
            }
          />
          <Button
            subtle
            title={t("Pause", "إيقاف مؤقت")}
            disabled={state.status !== "downloading"}
            onPress={() => action(() => modelManager.pause())}
          />
          <Button
            subtle
            title={t("Load", "تحميل للذاكرة")}
            disabled={!["ready", "error"].includes(state.status)}
            onPress={() => action(() => modelManager.load())}
          />
          <Button
            subtle
            title={t("Unload", "تفريغ الذاكرة")}
            disabled={state.status !== "loaded"}
            onPress={() => action(() => modelManager.unload())}
          />
          <Button
            subtle
            title={t("Delete model", "حذف النموذج")}
            onPress={() =>
              confirm(
                t("Delete downloaded model?", "حذف النموذج المنزّل؟"),
                () => modelManager.remove(),
              )
            }
          />
        </Row>
        <Button
          subtle
          title={t("Check free storage", "فحص المساحة المتاحة")}
          onPress={() =>
            action(async () => setStorage(await modelManager.getStorage()))
          }
        />
        {storage && (
          <Label muted>
            {(storage.free / 1e9).toFixed(2)} GB {t("free of", "متاح من")}{" "}
            {(storage.total / 1e9).toFixed(2)} GB
          </Label>
        )}
      </Card>
      {error && (
        <Card>
          <Label>{error}</Label>
        </Card>
      )}
      <Card>
        <Label>{t("Privacy & attribution", "الخصوصية والنسبة")}</Label>
        <Label muted>
          {t(
            "No analytics, account, or tracking. Dictionary, bookmarks and research history stay in app-private SQLite. Access tokens use the OS secure store on native; web tokens are memory-only. No Cloudflare account API key belongs here. Cloud AI requires your privately deployed authenticated Worker.",
            "لا تحليلات ولا حساب ولا تعقّب. المعجم والمحفوظات والسجل في SQLite خاص بالتطبيق. رموز الوصول في التخزين الآمن؛ على الويب في الذاكرة فقط. لا تضع مفتاح حساب Cloudflare هنا.",
          )}
        </Label>
        <Label muted>
          {t(
            "Arabic font: Noto Naskh Arabic, SIL Open Font License 1.1. Source works and their licenses are listed in Library and SOURCE_MANIFEST.md.",
            "الخط: Noto Naskh Arabic بترخيص SIL OFL 1.1. تُعرض حقوق الكتب في المكتبة وبيان المصادر.",
          )}
        </Label>
        <Button
          subtle
          title={t(
            "Clear bookmarks, explanations & history",
            "مسح المحفوظات والشروح والسجل",
          )}
          onPress={() =>
            confirm(
              t("Clear all saved research?", "مسح كل البحث المحفوظ؟"),
              clearSaved,
            )
          }
        />
      </Card>
    </Screen>
  );
}
