"""Build the unified SQLite index for ~/Tools/arabic-lexicon.

Sources:
  - Lane's Lexicon TEI XML at lane-xml/*.xml (parses <div2 type="root">)
  - Lisan al-Arab plain text at lisan-text/*.txt (entries delimited by ^@root:)
  - 12 OpenITI dictionaries at openiti-dicts/*.txt (full-text indexed, no root
    parsing — pre-modern dicts use varied formats; we treat each as a corpus
    and rely on FTS5 for substring lookup with windowed snippets)

Schema:
  entries(id INTEGER PK, dict TEXT, root_ar TEXT, root_norm TEXT,
          root_bw TEXT, body TEXT, body_norm TEXT, source TEXT)
  entries_fts -- FTS5 contentless mirror over root_norm, body_norm

Run: python build_index.py
"""

from __future__ import annotations

import os
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "lex.sqlite"

sys.path.insert(0, str(ROOT))
from buckwalter import bw_to_ar, normalize_ar  # noqa: E402

DICT_META = {
    "lane":             ("Lane's Lexicon (E.W. Lane, 19th c., based on classical sources)",          "en/ar"),
    "lisan":            ("Lisan al-ʿArab (Ibn Manẓūr, d. 711 AH)",                                     "ar"),
    "cayn-khalil":      ("Kitāb al-ʿAyn (al-Khalīl b. Aḥmad al-Farāhīdī, d. 170 AH)",                  "ar"),
    "jamharat-ibn-durayd": ("Jamharat al-Lugha (Ibn Durayd, d. 321 AH)",                              "ar"),
    "tahdhib-azhari":   ("Tahdhīb al-Lugha (al-Azharī, d. 370 AH)",                                    "ar"),
    "sihah-jawhari":    ("al-Ṣiḥāḥ Tāj al-Lugha (al-Jawharī, d. 393 AH)",                              "ar"),
    "maqayis-ibn-faris": ("Muʿjam Maqāyīs al-Lugha (Ibn Fāris, d. 395 AH)",                           "ar"),
    "mukhassas-ibn-sida": ("al-Mukhaṣṣaṣ (Ibn Sīdah, d. 458 AH)",                                     "ar"),
    "mufradat-raghib":  ("al-Mufradāt fī Gharīb al-Qurʾān (al-Rāghib al-Iṣfahānī, d. 502 AH)",        "ar"),
    "asas-zamakhshari": ("Asās al-Balāgha (al-Zamakhsharī, d. 538 AH)",                                "ar"),
    "mukhtar-sihah-razi": ("Mukhtār al-Ṣiḥāḥ (al-Rāzī, d. 666 AH)",                                  "ar"),
    "misbah-fayyumi":   ("al-Miṣbāḥ al-Munīr (al-Fayyūmī, d. 770 AH)",                                 "ar"),
    "qamus-firuzabadi": ("al-Qāmūs al-Muḥīṭ (al-Fīrūzābādī, d. 817 AH)",                              "ar"),
    "taj-zabidi":       ("Tāj al-ʿArūs (al-Zabīdī, d. 1205 AH)",                                       "ar"),
    "blau":             ("Blau, Dict. of Medieval Judaeo-Arabic Texts (2006) — structured",            "he/en/ar"),
    "blau-judeoarabic": ("Blau, Dict. of Medieval Judaeo-Arabic Texts (2006) — raw OCR fallback",      "he/ar"),
    "friedman":         ("Friedman, Dict. of Medieval Judeo-Arabic (India Book & other texts, Ben-Zvi 2016) — full text", "he/ar"),
}


# ---------- Lane ----------

ENTRY_RE = re.compile(
    r'<div2\s+n="([^"]+)"[^>]*type="root"[^>]*>(.*?)</div2>',
    re.DOTALL,
)
HEAD_AR_RE = re.compile(r'<head[^>]*>.*?<foreign[^>]*>([^<]+)</foreign>.*?</head>', re.DOTALL)
TAG_RE = re.compile(r'<[^>]+>')
WS_RE = re.compile(r'\s+')


def _strip_xml(s: str) -> str:
    s = TAG_RE.sub(' ', s)
    s = s.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    return WS_RE.sub(' ', s).strip()


def parse_lane(xml_dir: Path):
    """Yield (root_bw, root_ar, body) for every Lane root entry."""
    for path in sorted(xml_dir.glob('*.xml')):
        text = path.read_text(encoding='utf-8', errors='replace')
        for m in ENTRY_RE.finditer(text):
            root_bw = m.group(1)
            inner = m.group(2)
            head_match = HEAD_AR_RE.search(inner)
            head_token = head_match.group(1) if head_match else root_bw
            # Lane stores its 'Arabic' in Buckwalter inside <foreign>. Convert.
            root_ar = bw_to_ar(head_token)
            body = _strip_xml(inner)
            yield root_bw, root_ar, body, path.name


# ---------- Lisan ----------

LISAN_ENTRY_RE = re.compile(r'(?m)^@\s*([^:\n]{1,60}?)\s*:\s*')


def parse_lisan(text_dir: Path):
    """Yield (root_ar, body, source_file) for every @root: entry in the Lisan dump."""
    for path in sorted(text_dir.glob('*.txt')):
        text = path.read_text(encoding='utf-8', errors='replace')
        matches = list(LISAN_ENTRY_RE.finditer(text))
        for i, m in enumerate(matches):
            root_ar = m.group(1).strip()
            start = m.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            body = WS_RE.sub(' ', text[start:end]).strip()
            if not body:
                continue
            yield root_ar, body, path.name


# ---------- OpenITI plain text ----------

OPENITI_META_END = "#META#Header#End#"


def strip_openiti_header(text: str) -> str:
    """Strip the #META# prologue if present."""
    idx = text.find(OPENITI_META_END)
    if idx >= 0:
        return text[idx + len(OPENITI_META_END):]
    return text


def clean_openiti(text: str) -> str:
    """Reassemble continuation lines (~~) and drop hash prefixes for clean prose."""
    out_lines = []
    for line in text.splitlines():
        line = line.rstrip()
        if not line:
            continue
        if line.startswith('~~'):
            if out_lines:
                out_lines[-1] += ' ' + line[2:].strip()
            else:
                out_lines.append(line[2:].strip())
            continue
        if line.startswith('#'):
            line = line.lstrip('#').strip()
            if line.startswith('|'):
                line = line[1:].strip()
        out_lines.append(line)
    return '\n'.join(out_lines)


def parse_openiti(path: Path):
    """Return the cleaned full text of an OpenITI dictionary."""
    text = path.read_text(encoding='utf-8', errors='replace')
    return clean_openiti(strip_openiti_header(text))


# ---------- Blau (structured) ----------

import json  # local-scope import to keep header tidy


def _render_blau_entry(entry: dict, raw_block: str | None) -> str:
    """Render one cleaned Blau lemma into a multi-line readable body."""
    lines: list[str] = []
    head = entry.get('lemma_ar', '?')
    he = entry.get('lemma_he', '')
    pos = entry.get('pos_hint')
    head_line = head
    if he:
        head_line += f"  ({he})"
    if pos:
        head_line += f"  —  {pos}"
    lines.append(head_line)

    quality = entry.get('quality')
    if quality:
        lines.append(f"[quality: {quality}]")

    senses = entry.get('senses') or []
    if senses:
        lines.append("")
        lines.append("Senses:")
        for s in senses:
            bits = []
            if s.get('form'):
                bits.append(f"form {s['form']}")
            if s.get('preposition'):
                bits.append(f"+ {s['preposition']}")
            if s.get('with_article'):
                bits.append("[with definite article]")
            if s.get('register'):
                bits.append(f"({s['register']})")
            prefix = " ".join(bits)
            en = s.get('gloss_en', '') or ''
            heg = s.get('gloss_he', '') or ''
            gloss = " / ".join(g for g in (en, heg) if g)
            line = "  • "
            if prefix:
                line += prefix + ": "
            line += gloss
            lines.append(line)
            if s.get('notes'):
                lines.append(f"      note: {s['notes']}")

    idioms = entry.get('idioms') or []
    if idioms:
        lines.append("")
        lines.append("Idioms:")
        for i in idioms:
            phr_ar = i.get('phrase_ar', '')
            phr_he = i.get('phrase_he', '')
            phr = phr_ar
            if phr_he:
                phr += f"  ({phr_he})"
            en = i.get('gloss_en', '') or ''
            heg = i.get('gloss_he', '') or ''
            gloss = " / ".join(g for g in (en, heg) if g)
            lines.append(f"  • {phr} — {gloss}")

    variants = entry.get('variants') or []
    if variants:
        lines.append("")
        lines.append("Variants:")
        for v in variants:
            rel = v.get('relation', '')
            ar = v.get('ar', '')
            heg = v.get('he', '')
            tag = f" [{rel}]" if rel else ""
            tail = f"  ({heg})" if heg else ""
            lines.append(f"  • {ar}{tail}{tag}")

    refs = entry.get('cross_refs') or []
    if refs:
        lines.append("")
        lines.append("See also: " + ", ".join(refs))

    if raw_block:
        lines.append("")
        lines.append("Raw OCR block:")
        lines.append(raw_block.strip())

    return "\n".join(lines)


def parse_blau_structured(clean_path: Path, raw_path: Path):
    """Yield (lemma_ar, lemma_he, body, source) for each non-garbage cleaned
    Blau entry. Skips garbage-flagged entries entirely."""
    raw_by_id: dict[str, str] = {}
    if raw_path.exists():
        with raw_path.open(encoding='utf-8') as f:
            for line in f:
                try:
                    obj = json.loads(line)
                    raw_by_id[obj.get('entry_id', '')] = obj.get('raw_block', '')
                except json.JSONDecodeError:
                    pass

    with clean_path.open(encoding='utf-8') as f:
        for line in f:
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if '_error' in rec:
                continue
            input_id = rec.get('input_entry_id', '')
            raw_block = raw_by_id.get(input_id)
            for entry in rec.get('entries', []):
                if entry.get('is_garbage'):
                    continue
                lemma_ar = entry.get('lemma_ar', '').strip()
                if not lemma_ar:
                    continue
                lemma_he = (entry.get('lemma_he') or '').strip()
                body = _render_blau_entry(entry, raw_block if not entry.get('verbatim') else entry.get('verbatim'))
                source = f"blau-clean.jsonl#{input_id}"
                yield lemma_ar, lemma_he, body, source


# ---------- Build ----------

def build(db_path: Path = DB_PATH) -> None:
    if db_path.exists():
        db_path.unlink()
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("""
        CREATE TABLE entries (
            id INTEGER PRIMARY KEY,
            dict TEXT NOT NULL,
            root_ar TEXT,
            root_norm TEXT,
            root_bw TEXT,
            body TEXT NOT NULL,
            body_norm TEXT NOT NULL,
            source TEXT
        )
    """)
    conn.execute("""
        CREATE VIRTUAL TABLE entries_fts USING fts5(
            root_norm, body_norm,
            content='entries', content_rowid='id',
            tokenize='unicode61 remove_diacritics 2'
        )
    """)
    conn.execute("""
        CREATE TRIGGER entries_ai AFTER INSERT ON entries BEGIN
            INSERT INTO entries_fts(rowid, root_norm, body_norm)
            VALUES (new.id, new.root_norm, new.body_norm);
        END
    """)

    cur = conn.cursor()

    def insert(dict_slug, root_ar, root_bw, body, source):
        root_norm = normalize_ar(root_ar) if root_ar else ''
        body_norm = normalize_ar(body)
        cur.execute(
            "INSERT INTO entries(dict, root_ar, root_norm, root_bw, body, body_norm, source) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (dict_slug, root_ar, root_norm, root_bw, body, body_norm, source),
        )

    # Lane
    lane_dir = ROOT / "lane-xml"
    n = 0
    for root_bw, root_ar, body, src in parse_lane(lane_dir):
        insert("lane", root_ar, root_bw, body, src)
        n += 1
    print(f"  lane: {n} entries")

    # Lisan
    lisan_dir = ROOT / "lisan-text"
    n = 0
    for root_ar, body, src in parse_lisan(lisan_dir):
        insert("lisan", root_ar, None, body, src)
        n += 1
    print(f"  lisan: {n} entries")

    # OpenITI dictionaries — one big entry per dict, FTS-searchable
    oiti_dir = ROOT / "openiti-dicts"
    for path in sorted(oiti_dir.glob('*.txt')):
        slug = path.stem
        if slug not in DICT_META:
            print(f"  skip unknown dict: {slug}", file=sys.stderr)
            continue
        body = parse_openiti(path)
        insert(slug, None, None, body, path.name)
        print(f"  {slug}: {len(body):,} chars indexed")

    # Blau's Judaeo-Arabic dictionary — raw OCR fallback (one big text blob).
    # Used when a query lemma isn't structured-cleaned, or for substring search
    # across the whole dictionary.
    blau_path = ROOT / "blau-judeoarabic.txt"
    if blau_path.exists():
        body = WS_RE.sub(' ', blau_path.read_text(encoding='utf-8', errors='replace'))
        insert("blau-judeoarabic", None, None, body, blau_path.name)
        print(f"  blau-judeoarabic: {len(body):,} chars indexed (raw OCR)")

    # Friedman — documentary/India-Book Judeo-Arabic dictionary (Ben-Zvi 2016).
    # One big Hebrew-script text blob, FTS-searchable with windowed snippets
    # (same treatment as blau-judeoarabic). Prefers the LLM-cleaned text if it
    # exists; falls back to the deterministically-extracted raw text. Page
    # markers ([friedman <src> p.N | letter]) are kept inline for snippet locality.
    fried_dir = ROOT / "friedman-cleanup"
    fried = fried_dir / "friedman-clean.txt"
    if not fried.exists():
        fried = fried_dir / "friedman-raw.txt"
    if fried.exists():
        body = fried.read_text(encoding="utf-8", errors="replace")
        insert("friedman", None, None, body, fried.name)
        print(f"  friedman: {len(body):,} chars indexed ({fried.name})")

    # Blau structured — one row per cleaned lemma entry. Includes the Hebrew
    # transliteration in the body so FTS5 catches Hebrew-script queries.
    blau_clean = ROOT / "blau-cleanup" / "blau-clean.jsonl"
    blau_raw = ROOT / "blau-cleanup" / "blau-entries-raw.jsonl"
    if blau_clean.exists():
        n = 0
        for lemma_ar, lemma_he, body, source in parse_blau_structured(blau_clean, blau_raw):
            # root_norm is over lemma_ar (Arabic). For Hebrew-script lookup,
            # the CLI converts via ja_to_ar before matching.
            # Stash lemma_he in root_bw to make CLI Hebrew-exact-match possible
            # without a schema change.
            insert("blau", lemma_ar, lemma_he or None, body, source)
            n += 1
        print(f"  blau (structured): {n} lemma entries")

    conn.commit()
    conn.execute("INSERT INTO entries_fts(entries_fts) VALUES('optimize')")
    conn.commit()
    conn.close()
    size_mb = db_path.stat().st_size / (1024 * 1024)
    print(f"\nDB: {db_path} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    build()
