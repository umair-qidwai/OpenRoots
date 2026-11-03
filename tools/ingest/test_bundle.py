"""Acceptance checks against the actual bundled database, not fixtures."""
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import unittest

import pipeline

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'apps/mobile/assets/dictionaries'


class BundleTests(unittest.TestCase):
    def test_cli_exposes_reproducible_commands(self):
        result = subprocess.run([sys.executable, str(ROOT / 'tools/ingest/pipeline.py'), '--help'],
                                text=True, capture_output=True)
        self.assertEqual(result.returncode, 0)
        for command in ['build', 'download']:
            self.assertIn(command, result.stdout)

    def test_actual_bundle_has_requested_words_and_valid_citations(self):
        self.assertTrue((ASSETS / 'openroots.db').is_file(), 'real bundled SQLite is missing')
        with pipeline.closing(sqlite3.connect(f'file:{ASSETS}/openroots.db?mode=ro', uri=True)) as conn:
            self.assertEqual(conn.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
            self.assertEqual(conn.execute('PRAGMA foreign_key_check').fetchall(), [])
            for word in ['كتب','علم','رحمة','صبر','خوف','خشية','تقوى','غفر','هدى','نور']:
                normalized = pipeline.normalize_arabic(word)
                with self.subTest(word=word):
                    found = conn.execute('SELECT id,root,headword,text,source_url,locator FROM entries WHERE normalized_headword=? OR normalized_root=?',
                                         (normalized, normalized)).fetchall()
                    # Lane treats some requested nouns as inflectional forms
                    # inside a verb article, not independent headwords.
                    if not found:
                        found = conn.execute('SELECT e.id,e.root,e.headword,e.text,e.source_url,e.locator FROM passages_fts f JOIN passages p ON p.id=f.passage_id JOIN entries e ON e.id=p.entry_id WHERE passages_fts MATCH ?',
                                             ('"' + normalized + '"',)).fetchall()
                    self.assertTrue(found, f'No real source match for {word}')
                    self.assertTrue(all(e[3] and e[4].startswith('https://github.com/alpheios-project/lan/blob/') and e[5] for e in found))
                    self.assertTrue(conn.execute('SELECT passage_id FROM passages_fts WHERE passages_fts MATCH ? LIMIT 1',
                                                 ('"' + normalized + '"',)).fetchone())
            # The noun استغفار is not a headword in this edition. Verify
            # the actually attested verb article rather than inventing an alias.
            self.assertTrue(conn.execute('SELECT id FROM entries WHERE normalized_headword LIKE ? AND normalized_root=?',
                                         ('استغفر%', 'غفر')).fetchone())
            self.assertTrue(conn.execute("SELECT id FROM entries WHERE normalized_headword LIKE 'استغ%' LIMIT 1").fetchone())
            self.assertTrue(conn.execute("SELECT id FROM entries WHERE normalized_headword LIKE '%غفار%' LIMIT 1").fetchone())
            self.assertTrue(conn.execute("SELECT passage_id FROM passages_fts WHERE passages_fts MATCH 'mercy' LIMIT 1").fetchone())
            self.assertFalse(conn.execute("SELECT id FROM entries WHERE book_id='lisan' LIMIT 1").fetchone())
            metadata = json.loads((ASSETS / 'manifest.json').read_text())
            self.assertEqual(metadata['entryCount'], conn.execute('SELECT count(*) FROM entries').fetchone()[0])
            self.assertEqual(metadata['passageCount'], conn.execute('SELECT count(*) FROM passages').fetchone()[0])
            self.assertEqual(metadata['passageCount'], conn.execute('SELECT count(*) FROM passages_fts').fetchone()[0])
            self.assertEqual(conn.execute('SELECT count(*) FROM passages p LEFT JOIN entries e ON e.id=p.entry_id WHERE e.id IS NULL').fetchone()[0], 0)

    def test_every_bundled_entry_and_passage_matches_original_xml(self):
        import tarfile
        import xml.etree.ElementTree as ET
        self.assertTrue((ASSETS / 'openroots.db').is_file())
        with pipeline.closing(sqlite3.connect(f'file:{ASSETS}/openroots.db?mode=ro', uri=True)) as conn:
            seen = set()
            with tarfile.open(ROOT / 'data/sources/lane-alpheios.tar.gz', 'r|gz') as tf:
                for member in tf:
                    tree = ET.fromstring(tf.extractfile(member).read())
                    for ordinal, original in enumerate(tree.iter('entryFree')):
                        eid = pipeline.stable_id('entry-v1', 'lane', member.name,
                                                 original.get('id') or str(ordinal), ordinal)
                        row = conn.execute('SELECT text FROM entries WHERE id=?', (eid,)).fetchone()
                        self.assertIsNotNone(row, (member.name, ordinal))
                        self.assertEqual(row[0], ''.join(original.itertext()))
                        passages = conn.execute('SELECT text,normalized_text FROM passages WHERE entry_id=? ORDER BY ordinal', (eid,)).fetchall()
                        self.assertEqual(''.join(p[0] for p in passages), row[0])
                        for text, normalized in passages:
                            self.assertEqual(normalized, pipeline.normalize_arabic(text))
                        seen.add(eid)
            self.assertEqual(len(seen), conn.execute('SELECT count(*) FROM entries').fetchone()[0])


if __name__ == '__main__':
    unittest.main()
