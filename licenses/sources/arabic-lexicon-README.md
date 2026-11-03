# arabic-lexicon

A unified, **script-agnostic** command-line index over classical Arabic
dictionaries. Look up an Arabic root and get the full article from
**Lane's Lexicon** and **Lisān al-ʿArab** side by side; do full-text search
across everything. Queries can be typed in **Arabic script, Buckwalter
transliteration, or Hebrew script** (for Judeo-Arabic) — they are all
normalized to a common form before matching.

Everything is stored in one SQLite file with an FTS5 full-text index. No
third-party Python dependencies — standard library only.

## What's included

| Dictionary | Entries | Source / license |
|------------|--------:|------------------|
| **Lane's Lexicon** (E.W. Lane, 19th c.) | ~5,300 root entries | Perseus / [laneslexicon.github.io](https://laneslexicon.github.io/), CC BY-SA |
| **Lisān al-ʿArab** (Ibn Manẓūr, d. 711 AH) | ~8,450 root entries | public-domain text |

Both are indexed as **true root entries** — a lookup returns the whole
article, not a keyword snippet.

> **Note on Lane's text:** the Perseus XML stores Lane's Arabic in his original
> transliteration, so Lane entries display in romanization (`katabahu`,
> `kitaAbN`, …). Lisān displays in clean vocalized Arabic. Both are fully
> searchable in any input script.

## Install

```bash
git clone https://github.com/eliyahu-freedman/arabic-lexicon.git
cd arabic-lexicon
python build_index.py        # builds lex.sqlite from the bundled sources (~1 min)
```

The database (`lex.sqlite`) is a **build artifact** and is not committed — you
generate it once from the bundled text. Optionally `pip install -e .` to get an
`arabic-lex` command on your PATH; otherwise just run `python cli.py`.

## Usage

```bash
python cli.py lookup كتب              # full Lane + Lisan entries for a root
python cli.py lookup ktb              # same, via Buckwalter
python cli.py lookup כתב              # same, via Hebrew script (Judeo-Arabic)
python cli.py search الحكمة           # full-text search across all dictionaries
python cli.py lookup كتب --dict lisan # restrict to one dictionary
python cli.py show 2598               # print one full entry by id
python cli.py dicts                   # list dictionaries + entry counts
```

Add `--json` to any command for machine-readable output. `lookup` truncates
very long articles for the terminal — use `show <id>` for the complete text.

## Judeo-Arabic ↔ Arabic script conversion

`ja_script.py` is a self-contained converter between **Judeo-Arabic**
(Arabic written in Hebrew letters) and Arabic script. It powers Hebrew-script
lookups, but also runs standalone — useful for reading, or for converting a
Judeo-Arabic word so you can look it up in the Arabic dictionaries:

```bash
python ja_script.py "אלחכמה"     # → الحكمه   (Judeo-Arabic → Arabic)
python ja_script.py "الحكمة"      # → אלחכמה   (Arabic → Judeo-Arabic)
python ja_script.py test          # run the built-in conversion test suite
```

It handles **both** major marker conventions:

- **Rabbanite / Maimuni-circle** (geresh/apostrophe): ג׳→ج, ת׳→ث, כ׳→خ, ד׳→ذ,
  צ׳→ض, ט׳→ظ, ע׳→غ — including several apostrophe/geresh Unicode variants.
- **Karaite** (combining supraline dot U+05C4, plus tāʾ-marbūṭa marked by a
  combining diaeresis on final ה): גׄ→ج, כׄ→خ, ה̈→ة, etc.

It also disambiguates phoneme markers from **abbreviation markers** (e.g. ק׳ =
קולה, ח׳ = the divine epithet), which look identical but must not be converted.
See the docstring and the ~30 smoke tests in `ja_script.py` for the full mapping
(documented against Blau, *Grammar of Medieval Judaeo-Arabic*).

## Optional dictionaries (bring your own)

The build script also knows how to index **12 additional pre-modern Arabic
dictionaries** (al-ʿAyn, Tahdhīb, al-Ṣiḥāḥ, Maqāyīs, al-Mukhaṣṣaṣ, al-Mufradāt,
Asās al-Balāgha, Mukhtār al-Ṣiḥāḥ, al-Miṣbāḥ, al-Qāmūs, Tāj al-ʿArūs, Jamharat
al-Lugha) plus two modern Judeo-Arabic dictionaries (**Blau 2006**, **Friedman
2016**). These are **not distributed** here — the pre-modern editions come from
[OpenITI](https://openiti.org), and Blau/Friedman are **still under copyright**.

To add them locally, place the source files where the build script looks and
re-run `python build_index.py`. Missing sources are silently skipped, so the
public build with just Lane + Lisan always works.

| Slug(s) | Expected path | Format |
|---------|---------------|--------|
| 12 pre-modern dicts | `openiti-dicts/<slug>.txt` | OpenITI plain text |
| `blau` (structured) | `blau-cleanup/blau-clean.jsonl` | one JSON object per line |
| `blau-judeoarabic` | `blau-judeoarabic.txt` | raw OCR text |
| `friedman` | `friedman-cleanup/friedman-clean.txt` | plain text |

(See `build_index.py` for exact filenames and the OpenITI slug list.)

## Licensing

Source **code**: MIT (see `LICENSE`). Dictionary **data**: licensed separately
per source — see `NOTICE`. The Lane data is CC BY-SA (ShareAlike), so
redistributions of that portion must stay CC BY-SA and credit Perseus / the
Lane's Lexicon project. Do **not** add copyrighted dictionaries (Blau, Friedman)
to a public fork.

## How it works

- `build_index.py` parses each source and writes `lex.sqlite`: an `entries`
  table plus an FTS5 virtual table using `unicode61 remove_diacritics 2`, so
  diacritics and hamza variants are folded away at query time.
- `cli.py` detects the input script (Arabic / Hebrew / Buckwalter), converts to
  a common Arabic form via `buckwalter.py` and `ja_script.py`, then does an
  exact root match (Lane/Lisan) or an FTS search.
