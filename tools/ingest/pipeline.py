"""Reproducible OpenRoots dictionary ingestion; Python standard library only."""
import hashlib
from contextlib import closing
import json
from pathlib import Path
import re
import sqlite3
import tarfile
import unicodedata
import xml.etree.ElementTree as ET


def stable_id(*parts):
    """SHA-256 of unambiguous UTF-8 JSON; independent of SQL insertion order."""
    return hashlib.sha256(json.dumps(parts, ensure_ascii=False,
                                     separators=(',', ':')).encode()).hexdigest()


def segment(text, limit=1600):
    """Lossless contiguous slices, preferring whitespace in the latter half."""
    if limit < 1:
        raise ValueError('passage limit must be positive')
    start = 0
    while start < len(text):
        end = min(start + limit, len(text))
        if end < len(text):
            boundaries = list(re.finditer(r'\s+', text[start + limit // 2:end]))
            if boundaries:
                end = start + limit // 2 + boundaries[-1].end()
        yield text[start:end]
        start = end

BOOK = dict(id='lane', title="An Arabic-English Lexicon — Lane", author='Edward William Lane',
            license='CC-BY-SA-3.0-US', sourceUrl='https://github.com/alpheios-project/lan/tree/7dd04e1182c13a4b0883978867d2a3b04616542a')

SCHEMA = '''
PRAGMA foreign_keys=ON;
CREATE TABLE books(id TEXT PRIMARY KEY,title TEXT,author TEXT,source_url TEXT,license TEXT,edition TEXT,category TEXT);
CREATE TABLE entries(id TEXT PRIMARY KEY,book_id TEXT REFERENCES books(id),headword TEXT,root TEXT,normalized_headword TEXT,normalized_root TEXT,text TEXT,source_url TEXT,locator TEXT);
CREATE TABLE passages(id TEXT PRIMARY KEY,entry_id TEXT REFERENCES entries(id),book_id TEXT REFERENCES books(id),headword TEXT,root TEXT,text TEXT,normalized_text TEXT,ordinal INTEGER);
CREATE VIRTUAL TABLE passages_fts USING fts5(passage_id UNINDEXED,headword,normalized_text,tokenize='unicode61 remove_diacritics 2');
CREATE INDEX entries_root ON entries(normalized_root,book_id);
CREATE INDEX entries_headword ON entries(normalized_headword,book_id);
CREATE INDEX entries_book ON entries(book_id);
CREATE INDEX passages_entry ON passages(entry_id,ordinal);
CREATE INDEX passages_book ON passages(book_id);
'''


def download(lock_path, archive):
    """Fetch only the reviewed, pinned machine-readable files; atomic output."""
    import gzip
    import io
    import urllib.request
    lock = json.loads(Path(lock_path).read_text())
    archive = Path(archive)
    archive.parent.mkdir(parents=True, exist_ok=True)
    partial = archive.with_suffix('.partial')
    try:
        with partial.open('wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', mtime=0, filename='') as gz, tarfile.open(fileobj=gz, mode='w|') as tf:
            for meta in sorted(lock['files'], key=lambda item: item['path']):
                request = urllib.request.Request(meta['url'], headers={'User-Agent': 'OpenRoots-ingest/1'})
                with urllib.request.urlopen(request, timeout=90) as response:
                    data = response.read(meta['bytes'] + 1)
                if len(data) != meta['bytes'] or hashlib.sha256(data).hexdigest() != meta['sha256']:
                    raise ValueError('download SHA-256/length mismatch: ' + meta['path'])
                info = tarfile.TarInfo(meta['path'])
                info.size, info.mtime = len(data), 0
                tf.addfile(info, io.BytesIO(data))
        # Validate both the canonical archive and every member before replacing.
        for _ in verified_sources(partial, lock):
            pass
        partial.replace(archive)
    finally:
        partial.unlink(missing_ok=True)


def verified_sources(archive, lock):
    """Fail closed on corrupt, extra, duplicate, or missing archive members.

    Never extract paths to disk. XML parser receives only hash-pinned bytes.
    """
    with Path(archive).open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    if digest != lock['archiveSha256']:
        raise ValueError('archive SHA-256 mismatch')
    expected = {f['path']: f for f in lock['files']}
    seen = set()
    with tarfile.open(archive, 'r|gz') as tf:
        for member in tf:
            if member.name not in expected or member.name in seen or not member.isfile():
                raise ValueError('unlisted or duplicate archive member: ' + member.name)
            data = tf.extractfile(member).read()
            meta = expected[member.name]
            if len(data) != meta['bytes'] or hashlib.sha256(data).hexdigest() != meta['sha256']:
                raise ValueError('member SHA-256/length mismatch: ' + member.name)
            seen.add(member.name)
            yield member.name, data
    if seen != set(expected):
        raise ValueError('missing archive members: ' + ', '.join(sorted(set(expected) - seen)))


def build(archive, lock_path, db_path, manifest_path, source_paths=None):
    """Build the shared immutable schema from pinned Lane XML.

    source_paths is for small real-data regression builds, not the bundled CLI.
    Retain every upstream article, including duplicates; never silently drop data.
    """
    lock = json.loads(Path(lock_path).read_text())
    db_path, manifest_path = Path(db_path), Path(manifest_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = db_path.with_suffix('.building')
    tmp.unlink(missing_ok=True)
    count = passage_count = 0
    with closing(sqlite3.connect(tmp)) as conn:
        conn.executescript(SCHEMA)
        conn.execute('INSERT INTO books VALUES (?,?,?,?,?,?,?)',
                     (BOOK['id'], BOOK['title'], BOOK['author'], BOOK['sourceUrl'], BOOK['license'],
                      'Perseus / Alpheios TEI; revision ' + lock['revision'], 'dictionary'))
        for name, data in verified_sources(archive, lock):
            if source_paths is not None and name not in source_paths:
                continue
            for entry in parse_lane(data, name):
                eid = stable_id('entry-v1', BOOK['id'], name,
                                entry['source_key'], entry['ordinal'])
                head, root, text = entry['headword'], entry['root'], entry['text']
                url = 'https://github.com/' + lock['repository'] + '/blob/' + lock['revision'] + '/' + name
                locator = name + '; entryFree ordinal ' + str(entry['ordinal'] + 1)
                if not entry['source_key'].isdigit():
                    locator += '; XML id ' + entry['source_key']
                conn.execute('INSERT INTO entries VALUES (?,?,?,?,?,?,?,?,?)',
                             (eid, BOOK['id'], head, root, normalize_arabic(head),
                              normalize_arabic(root) if root else None, text, url, locator))
                for ordinal, passage in enumerate(segment(text)):
                    pid = stable_id('passage-v1', eid, ordinal, passage)
                    normalized = normalize_arabic(passage)
                    conn.execute('INSERT INTO passages VALUES (?,?,?,?,?,?,?,?)',
                                 (pid, eid, BOOK['id'], head, root, passage, normalized, ordinal))
                    conn.execute('INSERT INTO passages_fts VALUES (?,?,?)',
                                 (pid, normalize_arabic(head), normalized))
                    passage_count += 1
                count += 1
        conn.execute("INSERT INTO passages_fts(passages_fts) VALUES('optimize')")
        conn.commit()
        if conn.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('SQLite integrity validation failed')
    tmp.replace(db_path)
    manifest = dict(version='1.0.0', books=[dict(BOOK, entryCount=count, passageCount=passage_count)],
                    entryCount=count, passageCount=passage_count)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return manifest


def parse_lane(data, source_path):
    """Parse TEI editorial roots, retaining each entry's exact XML text nodes.

    XML markup is not display text; XML entity decoding and XML line-end
    normalization are performed by ElementTree. No whitespace is collapsed.
    """
    tree = ET.fromstring(data)
    roots = {}
    for division in tree.iter('div2'):
        head = division.find('head')
        root = ''.join(head.itertext()).strip() if head is not None else ''
        root = root if division.get('type') == 'root' and root else None
        for entry in division.iter('entryFree'):
            roots[id(entry)] = root
    for ordinal, entry in enumerate(tree.iter('entryFree')):
        orth = entry.find('./form/orth')
        headword = entry.get('key') or (''.join(orth.itertext()) if orth is not None else '')
        yield dict(headword=headword, root=roots.get(id(entry)),
                   text=''.join(entry.itertext()), source_path=source_path,
                   source_key=entry.get('id') or str(ordinal), ordinal=ordinal)


def normalize_arabic(text):
    """Search-only NFKC, Arabic marks/tatweel removal and alif/hamza folding.

    Ta marbuta stays distinct. Never apply this to source display fields.
    """
    text = unicodedata.normalize('NFKC', text)
    text = ''.join(c for c in text if c != '\u0640' and not (
        unicodedata.category(c).startswith('M') and
        ('ARABIC' in unicodedata.name(c, '') or '\u064b' <= c <= '\u065f')))
    return text.translate(str.maketrans('أإآٱؤئى', 'ااااويي'))


def main():
    import argparse
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['download', 'build'])
    parser.add_argument('--archive', type=Path, default=root / 'data/sources/lane-alpheios.tar.gz')
    parser.add_argument('--lock', type=Path, default=root / 'data/sources/lane.lock.json')
    parser.add_argument('--output', type=Path, default=root / 'apps/mobile/assets/dictionaries/openroots.db')
    parser.add_argument('--manifest', type=Path, default=root / 'apps/mobile/assets/dictionaries/manifest.json')
    args = parser.parse_args()
    if args.command == 'download':
        download(args.lock, args.archive)
        print('Verified source archive:', args.archive)
    else:
        result = build(args.archive, args.lock, args.output, args.manifest)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        print('SQLite bytes:', args.output.stat().st_size)


if __name__ == '__main__':
    main()
