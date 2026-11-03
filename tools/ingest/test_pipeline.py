"""Stdlib tests: run python -m unittest discover -s tools/ingest -v."""
import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.find_spec('pipeline')
pipeline = __import__('pipeline') if SPEC else None


class NormalizationTests(unittest.TestCase):
    def test_search_normalization_leaves_display_text_untouched(self):
        self.assertIsNotNone(pipeline, 'ingestion pipeline is not implemented')
        original = 'إِسْتِغْفَار أَكْتُبُ آثَار ٱلْهُدَى مُؤْمِن سُئِلَ ـ ﷲ'
        self.assertEqual(pipeline.normalize_arabic(original),
                         'استغفار اكتب اثار الهدي مومن سيل  الله')
        self.assertEqual(original, 'إِسْتِغْفَار أَكْتُبُ آثَار ٱلْهُدَى مُؤْمِن سُئِلَ ـ ﷲ')
        self.assertEqual(pipeline.normalize_arabic('رَحْمَة'), 'رحمة')


class LaneParsingTests(unittest.TestCase):
    def test_actual_xml_entries_preserve_text_and_editorial_roots(self):
        import tarfile
        import xml.etree.ElementTree as ET
        self.assertTrue(hasattr(pipeline, 'parse_lane'), 'Lane parser is missing')
        archive = Path(__file__).resolve().parents[2] / 'data/sources/lane-alpheios.tar.gz'
        with tarfile.open(archive) as tf:
            name = 'db/lexica/ara/lan/uk0.xml'
            data = tf.extractfile(name).read()
        originals = ET.fromstring(data).findall('.//entryFree')
        entries = list(pipeline.parse_lane(data, name))
        self.assertEqual(len(entries), len(originals))
        for entry, original in zip(entries, originals):
            self.assertEqual(entry['text'], ''.join(original.itertext()))
            self.assertEqual(entry['source_key'], original.get('id') or str(entry['ordinal']))
        writing = [e for e in entries if e['root'] == 'كتب']
        self.assertGreater(len(writing), 10)
        self.assertTrue(any(e['headword'] == 'كَتَبَهُ' for e in writing))
        # Alphabetical-letter articles are not fabricated roots.
        self.assertIsNone(entries[0]['root'])


class PassageTests(unittest.TestCase):
    def test_segmentation_is_lossless_and_ids_are_content_stable(self):
        self.assertTrue(hasattr(pipeline, 'segment'), 'lossless segmentation is missing')
        self.assertTrue(hasattr(pipeline, 'stable_id'), 'stable IDs are missing')
        text = ('  كَتَبَ\n\nHe wrote;  ' * 600) + '\n'
        chunks = list(pipeline.segment(text, 1200))
        self.assertGreater(len(chunks), 2)
        self.assertEqual(''.join(chunks), text)
        self.assertTrue(all(0 < len(c) <= 1200 for c in chunks))
        self.assertEqual(list(pipeline.segment('x' * 2501, 1200)),
                         ['x' * 1200, 'x' * 1200, 'x' * 101])
        self.assertEqual(list(pipeline.segment('', 1200)), [])
        with self.assertRaises(ValueError):
            list(pipeline.segment('test', 0))
        a = pipeline.stable_id('entry', 'lane', 'n1')
        self.assertEqual(a, pipeline.stable_id('entry', 'lane', 'n1'))
        self.assertNotEqual(a, pipeline.stable_id('entry', 'lane', 'n2'))
        self.assertNotEqual(pipeline.stable_id('a', 'bc'), pipeline.stable_id('ab', 'c'))


class DatabaseTests(unittest.TestCase):
    def test_build_real_source_into_contract_sqlite_and_deterministic_ids(self):
        import json
        import sqlite3
        import tempfile
        self.assertTrue(hasattr(pipeline, 'build'), 'SQLite builder is missing')
        root = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as td:
            db = Path(td) / 'test.db'
            manifest = Path(td) / 'manifest.json'
            args = (root / 'data/sources/lane-alpheios.tar.gz',
                    root / 'data/sources/lane.lock.json', db, manifest)
            pipeline.build(*args, source_paths={'db/lexica/ara/lan/uk0.xml'})
            with pipeline.closing(sqlite3.connect(db)) as conn:
                self.assertEqual(conn.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
                self.assertEqual(conn.execute('PRAGMA foreign_key_check').fetchall(), [])
                self.assertGreater(conn.execute('SELECT count(*) FROM entries WHERE normalized_root=?', ('كتب',)).fetchone()[0], 10)
                self.assertGreater(conn.execute('SELECT count(*) FROM passages_fts WHERE passages_fts MATCH ?', ('"wrote"',)).fetchone()[0], 0)
                self.assertGreater(conn.execute('SELECT count(*) FROM passages_fts WHERE passages_fts MATCH ?', ('"كتب"',)).fetchone()[0], 0)
                before = conn.execute('SELECT id,text FROM entries ORDER BY id').fetchall()
                passage_ids = conn.execute('SELECT id FROM passages ORDER BY id').fetchall()
                for eid, original in before:
                    pieces = conn.execute('SELECT text FROM passages WHERE entry_id=? ORDER BY ordinal', (eid,)).fetchall()
                    self.assertEqual(''.join(p[0] for p in pieces), original)
                metadata = json.loads(manifest.read_text())
                self.assertEqual(metadata['entryCount'], len(before))
                self.assertEqual(metadata['passageCount'], len(passage_ids))
                self.assertEqual(metadata['books'][0]['entryCount'], len(before))
                columns = [r[1] for r in conn.execute('PRAGMA table_info(entries)')]
                self.assertEqual(columns, ['id','book_id','headword','root','normalized_headword','normalized_root','text','source_url','locator'])
            pipeline.build(*args, source_paths={'db/lexica/ara/lan/uk0.xml'})
            with pipeline.closing(sqlite3.connect(db)) as conn:
                self.assertEqual(before, conn.execute('SELECT id,text FROM entries ORDER BY id').fetchall())
                self.assertEqual(passage_ids, conn.execute('SELECT id FROM passages ORDER BY id').fetchall())


class IntegrityTests(unittest.TestCase):
    def test_checksums_reject_archive_and_member_tampering(self):
        import gzip
        import hashlib
        import io
        import json
        import tarfile
        import tempfile
        self.assertTrue(hasattr(pipeline, 'verified_sources'), 'source verification is missing')
        root = Path(__file__).resolve().parents[2]
        lock = json.loads((root / 'data/sources/lane.lock.json').read_text())
        with tempfile.TemporaryDirectory() as td:
            archive = Path(td) / 'bad.tar.gz'
            archive.write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError, 'archive SHA-256'):
                list(pipeline.verified_sources(archive, lock))
            data = b'<TEI.2/>'
            with tarfile.open(archive, 'w:gz') as tf:
                info = tarfile.TarInfo(lock['files'][0]['path'])
                info.size = len(data)
                tf.addfile(info, io.BytesIO(data))
            lock['archiveSha256'] = hashlib.sha256(archive.read_bytes()).hexdigest()
            with self.assertRaisesRegex(ValueError, 'member SHA-256'):
                list(pipeline.verified_sources(archive, lock))
            lock['files'] = []
            with self.assertRaisesRegex(ValueError, 'unlisted'):
                list(pipeline.verified_sources(archive, lock))
            lock['files'] = [{'path':'missing.xml', 'sha256':hashlib.sha256(data).hexdigest(), 'bytes':len(data)}]
            with tarfile.open(archive, 'w:gz'):
                pass
            lock['archiveSha256'] = hashlib.sha256(archive.read_bytes()).hexdigest()
            with self.assertRaisesRegex(ValueError, 'missing'):
                list(pipeline.verified_sources(archive, lock))


class DownloadTests(unittest.TestCase):
    def test_download_is_reproducible_and_rejects_changed_sources(self):
        import gzip
        import hashlib
        import io
        import json
        import tarfile
        import tempfile
        self.assertTrue(hasattr(pipeline, 'download'), 'reproducible downloader is missing')
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            original = td / 'source.xml'
            original.write_bytes(b'<TEI.2>\n</TEI.2>')
            meta = dict(path='original.xml', url=original.as_uri(),
                        bytes=original.stat().st_size,
                        sha256=hashlib.sha256(original.read_bytes()).hexdigest())
            archive = td / 'expected.tar.gz'
            with archive.open('wb') as raw, gzip.GzipFile(fileobj=raw,mode='wb',mtime=0,filename='') as gz, tarfile.open(fileobj=gz,mode='w|') as tf:
                info = tarfile.TarInfo(meta['path'])
                info.size = meta['bytes']
                info.mtime = 0
                tf.addfile(info, io.BytesIO(original.read_bytes()))
            lock = dict(files=[meta], archiveSha256=hashlib.sha256(archive.read_bytes()).hexdigest())
            lock_path = td / 'lock.json'
            lock_path.write_text(json.dumps(lock))
            result = td / 'downloaded.tar.gz'
            pipeline.download(lock_path, result)
            self.assertEqual(result.read_bytes(), archive.read_bytes())
            original.write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'SHA-256'):
                pipeline.download(lock_path, result)
            self.assertEqual(result.read_bytes(), archive.read_bytes())


if __name__ == '__main__':
    unittest.main()
