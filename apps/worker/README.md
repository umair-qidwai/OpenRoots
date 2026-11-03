# OpenRoots Workers AI backend

Private personal-use Cloudflare Worker. **Not deployed by this task.** No account API token or access secret is checked in. The mobile application never needs a Cloudflare account credential.

## Dependencies and checks

From the monorepo root:

```sh
npm ci
npm run typecheck -w @openroots/worker
npm test -w @openroots/worker
npm run check:bundle -w @openroots/worker
```

The last command is `wrangler deploy --dry-run`, not a deployment or a real inference test. It validates the bundle and the AI/rate-limit configuration. Shared protocol tests run with `npm test -w @openroots/shared`.

## What is configured

`wrangler.jsonc` defines:

- Worker name `openroots-ai`, compatibility date `2026-11-02`.
- AI binding named `AI`.
- Rate limiter `RATE_LIMITER`, 6 requests per 60 seconds for the personal credential.
- `workers_dev: false` and `preview_urls: false`: no public preview endpoint is enabled by default.
- Observability off; request bodies, source text and authorization credentials are not deliberately logged.

The `remote: false` flag in the AI binding concerns development behavior; it is not proof of live Cloud AI on the local machine. Models need actual account/plan access in Cloudflare. Merely finding a model name in a catalog is insufficient.

## Configure and deploy deliberately

This step needs your Cloudflare account and approval. It can consume Workers/AI allowance; nothing enables paid usage automatically. Review your account limits before calling models.

1. From `apps/worker`, run `npx wrangler login` and complete account authorization yourself.
2. Choose how this authenticated service will be reachable:
   - Add a route/custom domain you control in the Wrangler config, or
   - Deliberately change `workers_dev` to `true` if an authenticated workers.dev address is acceptable for your personal test. Bearer authentication and limits still apply; do not remove them.
3. Set a random, private `ACCESS_TOKEN` secret. It must be **32–256 printable ASCII characters without whitespace**. Generate/store it privately using your password manager or a secure local command. Do not paste it into chat, commit it or put it in `EXPO_PUBLIC_*`.
4. Deploy and enter the secret when Wrangler prompts:

```sh
cd apps/worker
npx wrangler deploy
npx wrangler secret put ACCESS_TOKEN
```

The brief deployment before the secret is set fails closed with configuration errors; it is never unrestricted inference. You may set the secret on an existing named Worker before redeploying instead. Keep the token available in your own secure store so you can enter it in mobile Settings.

5. Verify the exact deployed route returns an authentication/configuration error without credentials, then use the mobile app to save the HTTPS base URL and your personal access token. Do not substitute a successful dry-run for this read-back.
6. In app Settings, choose **Check available models**. This performs tiny real inference probes and can consume quota. Availability is reported per account/model, not asserted from a static allowlist.

A missing/invalid secret, missing binding or unavailable rate limiter fails closed. A real deployment is not part of the automated tests here.

## Mobile configuration

Enter only the base URL (for example `https://your-worker.example`) and the personal Worker access token in **Settings > Cloud connection**. Do not append `/v1/generate` yourself. HTTPS is required; embedded credentials/query strings/fragments are rejected by the client.

The native app stores its access token with Expo SecureStore. The browser-preview token is memory-only, and the current Worker intentionally does not provide an unrestricted browser CORS policy. Native mobile requests are the supported client. If adding browser access, implement an explicit origin allowlist and authenticated preflight handling rather than `Access-Control-Allow-Origin: *` plus credentials.

## API

Every request requires:

```text
Authorization: Bearer <your-personal-worker-access-token>
```

### `GET /v1/models`

Returns a `models` array with `id`, `available` and, when unavailable, a sanitized reason. Current allowlist:

- `@cf/qwen/qwen3-30b-a3b-fp8` (default)
- `@cf/google/gemma-4-26b-a4b-it`

Account access and current quotas are probed, not guaranteed. Each request also uses the configured rate limiter.

### `POST /v1/generate`

Requires JSON content type and the shared `GenerateInput` envelope:

```json
{
  "question": "Explain the source-attested meaning of صبر.",
  "passages": [],
  "model": "@cf/qwen/qwen3-30b-a3b-fp8",
  "mode": "concise",
  "task": "explain",
  "history": [],
  "stream": false
}
```

`passages: []` above is intentionally an **insufficiency test**, not an example of generated dictionary evidence. The real app supplies retrieved `SourcePassage` objects from its actual database. Passage fields and all limits are defined in `packages/shared/src/index.ts`; do not fabricate IDs/text/page locators to make a request pass.

Successful non-streaming responses contain:

```text
{ sections: [{ title, text, citations: [realPassageId] }],
  insufficientEvidence: boolean, provider: "cloud", model: string }
```

Provider/model metadata is transport metadata. Both server and mobile revalidate the model-output evidence payload; unsupported IDs, invented inline locators/URLs, and unsupported quotations are rejected. Source text/history/user questions are treated as untrusted data, not system instructions. No model-initiated tools are available.

For `stream: true`, the service supports Workers AI SSE/OpenAI-style deltas but emits only progress character counts until output validation succeeds. Client events are `progress`, `answer`, `done`, or a sanitized `error`; it does **not** expose unvalidated raw source claims token by token. Disconnect/timeout propagates cancellation to the available binding/stream API.

## Limits, errors and retries

- JSON body bounded by the shared protocol (131,072 bytes); bounded question, source count/text/metadata, history and output.
- Short default generation; detailed mode increases its bounded output-token allowance.
- Whole-request timeout/cancellation including body consumption and upstream streaming.
- Authentication before inference and rate limiting before model probes/generation.
- Sanitized error envelopes, `Cache-Control: no-store`, no raw provider error/credential disclosure.
- Friendly rate/quota handling; retry controls live in the mobile UI. An invalid citation is a failed answer, not a silently repaired success.
- Cloud-to-Local fallback is an explicit mobile preference and only uses an already-loaded verified local model; it never uploads a Local request.

See `src/runtime.ts` and the tests for exact status/error mappings. Do not repeatedly retry a quota failure, raise limits, or enable a paid plan without the owner's decision.

## Verification scope

Automated tests inject the external AI binding to test protocol, authentication, limits, citations, cancellation and error handling. They are explicitly **not live Cloudflare inference**. Wrangler dry-run has been exercised without deployment. The remaining live gate is: deploy with your credentials, verify route/auth/limits, probe allowed models, make a real request with actual retrieved passages, and inspect cited source links in the phone app.
