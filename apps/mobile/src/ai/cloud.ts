import type {
  AIProvider,
  AIOptions,
  SourcePassage,
  AIAnswer,
} from "@openroots/shared";
import { parseCloudResponse } from "../core/cloud-response";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { safeEndpoint } from "../core/search";
let webToken = "";
export async function setAccessToken(token: string) {
  if (Platform.OS === "web") {
    webToken = token;
    return;
  }
  if (token)
    await SecureStore.setItemAsync("openroots.access", token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  else await SecureStore.deleteItemAsync("openroots.access");
}
async function token() {
  return Platform.OS === "web"
    ? webToken
    : await SecureStore.getItemAsync("openroots.access");
}
export class CloudflareAIProvider implements AIProvider {
  constructor(
    private endpoint: string,
    private model: string,
  ) {}
  async generate(
    question: string,
    passages: SourcePassage[],
    options: AIOptions = {},
  ): Promise<AIAnswer> {
    const access = await token();
    if (!access) throw new Error("Add your Worker access token in Settings.");
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 90000);
    const abort = () => timeout.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    try {
      const res = await fetch(safeEndpoint(this.endpoint) + "/v1/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + access,
        },
        body: JSON.stringify({
          question,
          passages,
          model: options.model ?? this.model,
          mode: options.mode ?? "concise",
          task: options.task ?? "explain",
          history: options.history ?? [],
          stream: false,
        }),
        signal: timeout.signal,
      });
      if (!res.ok) {
        if (res.status === 429)
          throw new Error(
            "Cloud quota or rate limit reached. Retry later or switch to your installed Local model.",
          );
        throw new Error(
          "Cloud request failed (" +
            res.status +
            "). Check access token, model and Worker URL.",
        );
      }
      const raw = await res.json();
      return parseCloudResponse(raw, passages, options.model ?? this.model);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }
  async models(): Promise<{ id: string; available: boolean }[]> {
    const access = await token();
    const r = await fetch(safeEndpoint(this.endpoint) + "/v1/models", {
      headers: { Authorization: "Bearer " + access },
    });
    if (!r.ok)
      throw new Error("Could not query model availability (" + r.status + ").");
    return (await r.json()).models;
  }
}
