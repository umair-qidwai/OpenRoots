# Reference study: Ghareeb

Observed from the public live site with Chromium on 2026-11-02. Reference only: no proprietary application code, branding, dictionary corpus, illustration, or font was imported into OpenRoots.

## Observed behavior and information architecture

- Public home at https://ghareeb.app/ is centered around one question/word input. Three adjacent controls expose Smart Mode, a library/dictionary picker, and Translate.
- Mobile navigation exposes Home, Bookmarks, Install, and More. Quick examples distinguish verse explanation, comparison, question, and direct lookup.
- The library picker exposes a searchable book tree, English/Arabic branches and dictionary titles/author metadata. The about page groups actual holdings into dictionaries, Qur'an, grammar, morphology, and rhetoric.
- Dictionary introduction pages display Arabic and transliterated titles, author information, a search field, dictionary descriptions, and other dictionaries.
- The public about page explains the intended key distinction: direct dictionary lookup without AI versus Smart Mode answers linking claims to highlighted source passages.
- A translation mode control is present. Detailed translation output, actual search results and AI citation behavior were **not verified**: automated input on the public dictionary introduction did not produce a results page during this inspection. No account was created, no login restriction bypassed, no private endpoint queried.
- Voice and image-input controls are visible, but these are outside the requested initial OpenRoots specification. Paid subscription/install flows were not exercised.

## OpenRoots adaptation

Retain the useful research workflow, not the visual identity: immediate search, direct book lookup, multi-source grounded explanation, comparison, passage translation, saved research and source navigation. OpenRoots uses its own ivory/forest/charcoal identity and native mobile routes, with explicit Cloud/Local model controls and offline-first storage rather than copying Ghareeb's artwork, decorative book ticker, identity or account system.

Only imported source categories appear. Source availability/license checks, authoritative roots and original text matter more than matching the reference's book count. A public site's book listing is not evidence of permission to copy its editions.

## Inspection evidence

Screenshots and raw fetched HTML were temporary research artifacts, excluded from the distributed app and from version control. The study does not establish Ghareeb's internal retrieval design or dataset rights.

## Primary implementation documentation inspected

- https://docs.expo.dev/versions/latest/ and version-specific package pages
- https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/
- https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://github.com/mybigday/llama.rn (README and package types)
- Dictionary licensing and pinned edition details: see SOURCE_MANIFEST.md.

Dependency compatibility, native capabilities and hosted model names are checked against primary documentation; documentation presence is not a substitute for executing inference on the user's account/device.
