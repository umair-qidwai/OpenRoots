# PySarf

**Python-native Arabic morphology engine powered by NumPy.**

PySarf performs root extraction, morphological pattern identification, segmentation, and stemming for Arabic text. It uses a rule-based hypothesis-and-rank algorithm with vectorized NumPy batch processing -- no ML models, no Java dependencies, no subprocess calls.

## Features

- **Root extraction** -- derive the trilateral/quadrilateral root from any Arabic word
- **Pattern identification** -- identify the morphological pattern (wazn/وزن) of a word
- **Segmentation** -- split words into prefixes + stem + suffixes
- **Stemming** -- fast greedy affix removal
- **Batch processing** -- vectorized NumPy pipeline for processing word lists
- **Gulf dialect** -- built-in support for Gulf Arabic normalization and lexical mappings
- **Pure Python** -- `pip install` and go. Single dependency: NumPy

## Installation

```bash
pip install pysarf
```

For development:

```bash
git clone https://github.com/Rashidbm/pysarf.git
cd pysarf
pip install -e ".[dev]"
```

## Quick Start

```python
from pysarf import PySarf

sarf = PySarf()

# Full morphological analysis
result = sarf.analyze("المكتبات")
print(result.root)        # كتب
print(result.pattern)     # مفعل
print(result.stem)        # مكتب
print(result.prefixes)    # ('ال',)
print(result.suffixes)    # ('ات',)
print(result.score)       # 0.85 (confidence 0.0-1.0)
```

## API Reference

### Initialization

```python
from pysarf import PySarf

# Standard MSA analyzer
sarf = PySarf()

# Gulf dialect analyzer
sarf_gulf = PySarf(dialect="gulf")

# Custom data directory
sarf_custom = PySarf(data_dir="/path/to/data")
```

**Parameters:**
- `dialect` -- `"msa"` (default) for Modern Standard Arabic, `"gulf"` for Gulf Arabic
- `data_dir` -- optional path to custom data files (defaults to bundled data)

### Single-Word API

#### `analyze(word) -> AnalysisResult`

Full morphological analysis: root extraction, pattern matching, and segmentation.

```python
result = sarf.analyze("يكتبون")
result.root          # "كتب"
result.root_letters  # ("ك", "ت", "ب")
result.pattern       # "يفعلون" (Arabic pattern)
result.pattern_name  # "yaFCaLuun" (transliterated)
result.stem          # "كتب"
result.prefixes      # ("ي",)
result.suffixes      # ("ون",)
result.score         # 0.8 (confidence 0.0-1.0)
result.is_oov_guess  # False
```

#### `extract_root(word) -> str | None`

Extract just the root. Returns `None` if unknown.

```python
sarf.extract_root("استخراج")  # "خرج"
sarf.extract_root("مكتبة")    # "كتب"
sarf.extract_root("hello")    # None
```

#### `stem(word) -> str`

Fast greedy stemming (affix removal only, no root validation).

```python
sarf.stem("وسيكتبون")  # "كتب"
sarf.stem("المدرسة")   # "مدرس"
```

#### `segment(word) -> SegmentResult`

Segment a word into its morphological components.

```python
seg = sarf.segment("وبالمدرسة")
seg.prefix_segments  # ("و", "ب", "ال")
seg.stem             # "مدرس"
seg.suffix_segments  # ("ة",)
seg.segments         # ("و", "ب", "ال", "مدرس", "ة")
```

#### `identify_pattern(word) -> str | None`

Identify the morphological pattern (wazn) of a word.

```python
sarf.identify_pattern("كاتب")   # "فاعل"
sarf.identify_pattern("مكتوب")  # "مفعول"
```

### Batch API

All batch methods accept a `list[str]` and use vectorized NumPy processing for lists of 10+ words.

#### `analyze_batch(words) -> BatchResult`

```python
results = sarf.analyze_batch(["كاتب", "مدرسة", "يدرسون"])
len(results)          # 3
results.roots         # ["كتب", "درس", "درس"]
results.patterns      # ["فاعل", "مفعل", ...]
results.stems         # ["كاتب", "مدرس", "درس"]
results.scores        # [0.8, 0.85, 0.75]

# Index into individual results
result = results[0]   # AnalysisResult for "كاتب"
```

#### `extract_roots_batch(words) -> list[str | None]`

```python
roots = sarf.extract_roots_batch(["كتاب", "مدرسة", "جميل"])
# ["كتب", "درس", "جمل"]
```

#### `stem_batch(words) -> list[str]`

```python
stems = sarf.stem_batch(["المكتبات", "يدرسون", "كاتبة"])
# ["مكتب", "درس", "كاتب"]
```

#### `segment_batch(words) -> list[SegmentResult]`

```python
segments = sarf.segment_batch(["والكاتب", "بالمدرسة"])
# List of SegmentResult objects
```

### Data Types

#### `AnalysisResult`

| Field          | Type                    | Description                              |
|----------------|-------------------------|------------------------------------------|
| `word`         | `str`                   | Original input word                      |
| `root`         | `str \| None`           | Extracted root (e.g., "كتب")             |
| `root_letters` | `tuple[str,...] \| None`| Root as individual letters               |
| `pattern`      | `str \| None`           | Arabic pattern (e.g., "فاعل")            |
| `pattern_name` | `str \| None`           | Transliterated pattern (e.g., "FaaCiL")  |
| `stem`         | `str`                   | Stem after affix removal                 |
| `prefixes`     | `tuple[str,...]`        | Stripped prefixes, in order              |
| `suffixes`     | `tuple[str,...]`        | Stripped suffixes, in order              |
| `score`        | `float`                 | Confidence score (0.0 - 1.0)            |
| `is_oov_guess` | `bool`                  | True if root not found in database       |

#### `SegmentResult`

| Field              | Type              | Description                     |
|--------------------|-------------------|---------------------------------|
| `word`             | `str`             | Original input word             |
| `segments`         | `tuple[str,...]`  | All segments in order           |
| `prefix_segments`  | `tuple[str,...]`  | Prefix segments only            |
| `stem`             | `str`             | The stem segment                |
| `suffix_segments`  | `tuple[str,...]`  | Suffix segments only            |

#### `BatchResult`

| Field      | Type                | Description                    |
|------------|---------------------|--------------------------------|
| `words`    | `list[str]`         | Original input words           |
| `roots`    | `list[str \| None]` | Extracted roots                |
| `patterns` | `list[str \| None]` | Pattern names                  |
| `stems`    | `list[str]`         | Stems                          |
| `scores`   | `list[float]`       | Confidence scores              |

Supports `len()` and indexing (`results[i]` returns an `AnalysisResult`).

### Gulf Dialect

Gulf Arabic support includes character normalization and lexical mappings:

```python
sarf_gulf = PySarf(dialect="gulf")

# Gulf-specific characters normalized to MSA
# پ → ب, چ → ج, گ/ک → ك, ی → ي

# Lexical mappings (Gulf → MSA equivalents)
result = sarf_gulf.analyze("وين")  # Gulf "where" → analyzed via MSA mapping
```

## Accuracy

Root extraction accuracy benchmarked against two standard Arabic corpora:

| Dataset | Words | Accuracy |
|---------|-------|----------|
| [Quranic Arabic Corpus](https://corpus.quran.com/) | 14,316 | **97.2%** |
| [Arabic Digital Humanities](https://github.com/arabic-digital-humanities/root-extraction-validation-data) | 2,064 | **89.3%** |

PySarf combines a rule-based hypothesis-and-rank algorithm with corpus-verified correction tables. It uses no machine learning models -- accuracy comes from linguistic rules, a root database of 9,520 entries, root frequency weighting, and 1,601 corpus-verified word-level overrides.

To run the benchmarks yourself:

```bash
python benchmarks/bench_accuracy.py
```

## How It Works

PySarf uses a **hypothesis-and-rank** algorithm:

1. **Normalize** -- strip diacritics, expand shadda, normalize alef variants
2. **Segment** -- generate all valid prefix/suffix stripping hypotheses
3. **Match patterns** -- for each stem hypothesis, match against 60 morphological patterns using vectorized NumPy broadcasting
4. **Extract roots** -- extract candidate roots from pattern slots
5. **Validate** -- check each candidate root against a database of 9,520 Arabic roots
6. **Transform** -- try weak-letter substitutions for hollow, defective, and assimilated roots
7. **Score and rank** -- score candidates by pattern frequency, root validity, segmentation confidence, and morphological features
8. **Return best** -- return the highest-scoring candidate (or an OOV guess if no valid root found)

## Data

PySarf ships with bundled linguistic data:

| Resource             | Count  | Source                                      |
|----------------------|--------|---------------------------------------------|
| Trilateral roots     | 6,385  | [arabic-roots](https://github.com/linuxscout/arabic-roots) (Taha Zerrouki) |
| Quadrilateral roots  | 3,135  | arabic-roots                                |
| Broken plural maps   | 5,628  | [Arramooz](https://github.com/linuxscout/arramooz) dictionary               |
| Morphological patterns| 60    | Lengths 3-8                                 |

## Requirements

- Python >= 3.10
- NumPy >= 1.24

## License

MIT
