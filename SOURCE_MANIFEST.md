# OpenRoots source manifest

Only the imported work below is included in the shipped dictionary database. Public access or the age of an original book is not treated as proof that an arbitrary digital edition can be redistributed.

## Imported: An Arabic-English Lexicon — Lane

- **Author:** Edward William Lane.
- **Original publication:** London, Williams and Norgate; the retained digital edition's attribution names 1863.
- **Digital edition:** Perseus Digital Library at Tufts University, with corrections by the Alpheios Project, Ltd.; TEI XML from `alpheios-project/lan`.
- **Pinned source:** https://github.com/alpheios-project/lan/tree/7dd04e1182c13a4b0883978867d2a3b04616542a
- **Digital-edition license:** Creative Commons Attribution–ShareAlike 3.0 United States (`CC-BY-SA-3.0-US`).
- **Attribution:** Original digitization provided by the Perseus Digital Library at Tufts University, under support of the U.S. Department of Education and the Max Planck Society. Corrections added by the Alpheios Project, Ltd.
- **License record:** `licenses/sources/lane-README.md` and `licenses/sources/lane-CC-BY-SA-3.0-US.html`. Preserve attribution and the digital edition's ShareAlike conditions when distributing the corpus/derived data; the app's code licensing does not replace those conditions.
- **Import status:** imported and bundled, 49,473 source entries and 55,668 passages; stable IDs, source URLs, XML locators, original text, separate normalized fields and SQLite indexes.
- **Database:** `apps/mobile/assets/dictionaries/openroots.db`, 221,884,416 bytes.
- **Git packaging:** the exact DB is committed as `apps/mobile/assets/bundled/openroots.db.gz` (45,571,264 bytes), with pinned compressed/expanded hashes and expanded size in the adjacent manifest. Root `npm ci` restores the ignored raw DB automatically. No Git LFS account or separate data download is required; this is the same licensed corpus, not substituted data.
- **Database SHA-256:** `99f586c21e1fdab14e5540c16669b839aeb11c2951fb08e7a9ec06a64a7051b0`.
- **Reproducibility:** `tools/ingest/pipeline.py`, `data/sources/lane.lock.json`, and `apps/mobile/assets/dictionaries/manifest.json`. The lock records each permitted source file, exact URL, size, and digest. The archive is a development input, not an application asset.
- **Missing digital headings:** 258 imported entries have no explicit extracted headword. Their original text remains readable/bookmarkable with an explicit unheaded-entry label; they are excluded from AI evidence and translation rather than assigned a fabricated heading.
- **Known limits:** Lane's prose definitions are primarily English with Arabic lemmata and quotations, not an invented Arabic-only dictionary. Plain text is extracted from original XML text nodes; XML typography/markup is not a facsimile. Source-assigned headwords/roots are retained; the app does not infer a root merely by stemming a user query. Locators identify the pinned XML file/entry rather than fabricated page numbers. Passage segmentation is an application processing step, not an editorial claim about sentence boundaries in the original book.

## Investigated reference implementation

`https://github.com/eliyahu-freedman/arabic-lexicon` was inspected first. Saved evidence includes its `README`, `LICENSE`, `NOTICE`, and `build_index.py` under `licenses/sources/`. Its source code is MIT, with separately licensed dictionary data. OpenRoots has its own ingestion/storage/provider interface; no claim is made that MIT code licensing automatically permits all bundled/reference data.

The reference project's **Lisān** NOTICE explicitly leaves the exact digital-edition source/license as a TODO before public release. Its README's public-domain description of the underlying classical work does not resolve that TODO. For that reason, its Lisān plain text was **not imported**.

## Requested works not bundled

These titles remain absent rather than being populated with generated or insufficiently licensed text:

- **Lisān al-ʿArab — Ibn Manẓūr.** Candidate: `eliyahu-freedman/arabic-lexicon` (`lisan-text`). Underlying classical work is old, but the exact digital-edition provenance/license in the retained NOTICE is unresolved. **Skipped; 0 imported entries.** A verified edition/permission decision is required before import.
- **Al-Mufradāt fī Gharīb al-Qurʾān — al-Rāghib al-Iṣfahānī.** OpenITI/reference-project candidate only; no verified redistribution-compatible digital edition selected for this build. **Skipped; 0 imported entries.**
- **Mukhtār al-Ṣiḥāḥ — Muḥammad ibn Abī Bakr al-Rāzī.** Same candidate/provenance restriction. **Skipped; 0 imported entries.**
- **Kitāb al-ʿAyn — al-Khalīl ibn Aḥmad, traditionally attributed.** No verified digital edition selected. **Skipped; 0 imported entries.**
- **Maqāyīs al-Lugha — Ibn Fāris.** No verified digital edition selected. **Skipped; 0 imported entries.**
- **Al-Qāmūs al-Muḥīṭ — al-Fīrūzābādī.** No verified digital edition selected. **Skipped; 0 imported entries.**
- **Tāj al-ʿArūs — al-Zabīdī.** No verified digital edition selected. **Skipped; 0 imported entries.**

Candidate corpus: https://github.com/OpenITI/RELEASE and https://github.com/OpenITI. OpenITI's noncommercial/share-alike licensing must not be silently included in a potentially commercially distributed build. This build does not bundle OpenITI text. The candidate status above is not a claim that a title's exact edition, access, or rights have been verified.

Additional Lane candidates requested for investigation: https://github.com/laneslexicon/lexicon_xml and https://github.com/laneslexicon/LexiconDatabase. The actual imported edition is the revision-pinned Perseus/Alpheios edition above; no unverified substitute is silently mixed into it.

## Morphology investigation

Evidence retained for CAMeL Tools and PySarf under `licenses/sources/`. No engine was selected merely because its repository code is permissively licensed: data/model license, runtime compatibility and accuracy also need verification. OpenRoots therefore reports source-provided roots, and explicitly limited spelling aliases, **not authoritative morphology extraction**. Unknown or ambiguous forms are not silently mapped to a single guessed root.

## Other bundled or optional assets

- **Noto Naskh Arabic:** bundled font under SIL Open Font License 1.1; font and full OFL record in `apps/mobile/assets/fonts/`.
- **OpenRoots icon/mark:** original editable SVG plus generated PNG assets in `apps/mobile/assets/brand/`; no Ghareeb assets or decorative ticker are included. Reproduction script: `apps/mobile/scripts/create-icons.py`.
- **Qwen3 4B Q4_K_M GGUF:** optional user-initiated model download, not bundled. Apache-2.0 model repository; pinned revision/digest/size in `docs/LOCAL_AI.md` and model manager. Neural model weights are not used as the primary dictionary database.
