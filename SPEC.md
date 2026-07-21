# ortho — Specification

**Status:** authoritative. This document defines what *ortho* is. The reference
implementation (JavaScript, this repo) conforms to this spec; the Max external
(`ortho-max`), the openFrameworks add-on (`ortho-of`), and the shared C kernel
(`ortho-kernel`) all conform to it too. When an implementation and this spec
disagree, the spec wins and the implementation is a bug.

Coherence across hosts is *proven*, not hoped for: every host that generates
output diffs it against the published golden vectors (§8). Same seed → same
language → byte-identical tokens, on every platform.

**Spec version:** 1.0 · **Vector set:** v1 · **PRNG:** Mulberry32

---

## 1. What ortho is

ortho generates *invented language* — pseudo-words with the uncanny quality of
text you can almost read but do not belong to. A single ortho instance builds a
persistent **language substrate** once from a seed, then draws every word from
that same substrate for its entire life. Same seed → same language,
reproducibly. Close and reopen → same seed gives the same language; a new seed
gives a new one.

Two output audiences, one engine:

- **Readable** (`word`/`sentence`/`paragraph`/`page`) — structure-controlled,
  human-facing; carries punctuation and recurrence when dialed on.
- **Neutral / harness** (`tokens`) — count-exact, structure-free; the substrate
  any intake driver consumes. Never carries punctuation.

---

## 2. Determinism and the PRNG

All randomness comes from **Mulberry32**, a 32-bit seedable PRNG. No other
source of randomness may be used — not the host language's `rand()`, not wall
clock, nothing. This is what makes output portable across languages.

```
state : uint32, initialized to seed (seed 0 is legal and deterministic)

nextU32():
  state = (state + 0x6D2B79F5) mod 2^32
  t = state
  t = (t XOR (t >> 15)) * (t | 1)          # multiply mod 2^32
  t = t XOR (t + (t XOR (t >> 7)) * (t | 61))   # all mod 2^32
  return (t XOR (t >> 14)) mod 2^32

next():        return nextU32() / 4294967296.0    # float in [0,1)
below(n):      return floor(next() * n)            # int in [0,n)
```

C uses native `uint32_t`/`uint64_t`. JS emulates uint32 with `>>> 0` and
`Math.imul`. The two MUST produce identical `nextU32()` streams from the same
seed.

**The cardinal rule of determinism:** output depends only on the seed and the
sequence of PRNG draws. Therefore *the number and order of draws must be
identical across implementations*. Every section below that consumes the PRNG
specifies its draw order for exactly this reason. Adding, removing, or
reordering a draw changes the language and breaks vector conformance.

---

## 3. Character sets (fixed canon)

```
ALPHABET    = "abcdefghijklmnopqrstuvwxyz"   (26 — full alphabet)
CONSONANTS  = "bcdfghjklmnpqrstvwxz"          (20)
VOWELS      = "aeiouy"                         (6)
PUNCTUATION = ".?!"                            (terminal marks)
```

These are constant, not generated. Note `y` is treated as a vowel.

---

## 4. Substrate generation (once per instance, in this exact order)

Run at construction, immediately after dials are set. Draw order is normative.

1. **Vowel digraphs** — nested loop `i` over VOWELS, `j` over VOWELS; push
   `VOWELS[i]+VOWELS[j]`. 36 entries. **No PRNG draws.**
2. **Consonant digraphs** — 30 iterations. Each: draw `a=below(20)`, draw
   `b=below(20)`; while `a==b` redraw `b`. Push `CONSONANTS[a]+CONSONANTS[b]`.
3. **Consonant trigraphs** — 10 iterations. Each: draw three `below(20)` into
   `idx[0..2]`; then de-dupe: for `a` in 0..2, for `b` in 0..2, if `a!=b` then
   while `idx[a]==idx[b]` redraw `idx[b]=below(20)`. Push the three letters.
4. **Contractions** — 20 iterations. For `k<5`: draw two `below(26)`, push
   `"'"+ALPHABET[a]+ALPHABET[b]`. For `k>=5`: draw one `below(26)`, push
   `"'"+ALPHABET[a]`.
5. **Names** — build 15 (see §5.3).
6. **Function words** — build 20 (see §5.4).

The substrate tables are immutable for the instance's life.

---

## 5. Word generation

### 5.1 `word(numLetters, contractions=true)`

Produces one word. Draw order (normative):

1. Clamp `n = numLetters`; if `n<=0`, `n=1`.
2. **Vowel/consonant split.** If `n>5`: `numVowels = floor(next()*n/2)`, then a
   fixed branch may set `numVowels=n/2`. Else (`n<=5`): draw `below(2)`; a
   short-word table sets `numVowels` to 1 or 2 per the reference. Then
   `numConsonants = n - numVowels` (min 1).
3. **Pools.** Draw `numVowels` × `below(6)` into a vowel string; draw
   `numConsonants` × `below(20)` into a consonant string.
4. **Assembly.** If `numVowels<=1 && numConsonants>=5`: insert the vowels at
   `floor(numConsonants/2)`. Else pick a **mix mode** `below(4)`:
   - 0: interleave vowel-first, forward
   - 1: interleave consonant-first, forward
   - 2: interleave vowel-first, reverse
   - 3: interleave consonant-first, reverse

   All four modes are REQUIRED — the irregularity is the uncanny effect.
5. **Digraph/trigraph injection.** Draw `below(2)`; if 0: when `length>9`, splice
   a trigraph (draw its index) at an end determined by mode; when `5<length<8`,
   splice a digraph (draw its index) similarly.
6. **Contraction.** If `contractions` and `below(4)==0`, append a contraction
   (draw its index via §5.5).
7. **Leading double-letter fix.** If `length>3` and `word[0]==word[1]`, insert
   `word[2]` at position 1.

### 5.2 String helpers

- `insertAt(s, add, i)` → `s[0..i] + add + s[i+1..]`
- `spliceRange(s, add, from, to)` → `s[0..from] + add + s[to..]`

Pure functions. (The reference's history had these misused as constructors;
they are ordinary functions.)

### 5.3 Names (15, built at substrate time)

For each: draw `ranTest=below(10)`; if `<3`, `ranTest=5`. Generate
`word(ranTest, contractions=false)`, title-case the first letter. Names are
capitalized; they are the "phony who."

### 5.4 Function words (20, built at substrate time)

A growing size counter starting at 2, incremented every `floor(20/4)=5` words.
Each: `word(size, contractions=false)`. These are the grammar-glue.

### 5.5 Contraction draw

Always `contractions[below(len)]` — indexed safely against the table's own
length. (Historical bug indexed by consonant count; do not reproduce.)

---

## 6. The seven dials

Each dial is a float in `[0,1]`, clamped, **default 0**. Each governs exactly
one behavior. Names are frozen vocabulary — identical across JS opts, Max
attributes/messages, and oF setters.

**Recurrence family** (affects all generation, including `tokens`):

| dial | scope | effect |
|---|---|---|
| `phrases` | section | multi-word phrase recurrence, phrase-first atomic |
| `functionWords` | document | grammar-glue recurrence |
| `topics` | section | the phony *what* recurring |
| `names` | section | the phony *who* recurring (capitalized) |

**Punctuation family** (readable path ONLY — never touches `tokens`):

| dial | effect |
|---|---|
| `commas` | narrative pacing; function-word-anchored, rhythmic fallback |
| `quotation` | direct-speech span in `"…"`, speaker-anchored to a cast name |
| `scareQuotes` | a single term wrapped in `"…"` |

**`preset`** (glue-level convenience, NOT part of the kernel contract): a single
value that, if `>0`, fills the seven dials with tuned proportions
(`phrases .5·P, functionWords .9·P, topics .6·P, names .5·P, commas .8·P,
quotation .4·P, scareQuotes .25·P`). Any explicit per-dial value overrides the
preset. The kernel exposes only the seven dials; `preset` is implemented in each
host's glue and MUST NOT introduce PRNG draws of its own.

---

## 7. Recurrence and section model

### 7.1 Section cast (tier 2)

`newSection()` mints a fresh cast — names, topics, and phrases — selected/generated
ONCE and then reused verbatim. Minting clears the phrase queue (§7.3) so no
phrase bleeds across sections. All recurring terms are ≥ 2 letters. A section
boundary discards the previous cast. `page()` is a section boundary when any
recurrence dial is > 0; `newSection()` forces one explicitly.

### 7.2 Recurrence resolver (per word slot)

Returns a recurring term, or "generate fresh." Normative order:

1. **Drain:** if the phrase queue is non-empty, return its next word. Atomic —
   a started phrase finishes before anything else rolls.
2. **Short-circuit:** if `phrases`, `functionWords`, `topics`, `names` are all
   0, return "fresh" with **zero PRNG draws**. (This is what preserves the
   golden vectors at the all-zero default.)
3. Ensure a section exists (mint if null).
4. **Independent rolls, fixed order, first hit wins:**
   - if `phrases>0` and cast has phrases and `next()<phrases`: load phrase tail
     into the queue, return word 0.
   - else if `functionWords>0` and `next()<functionWords`: return a function word.
   - else if `topics>0` and `next()<topics`: return a topic.
   - else if `names>0` and `next()<names`: return a name.
   - else "fresh."

### 7.3 Phrase queue

A phrase, when it fires, pushes its remaining words onto a queue that drains
verbatim on subsequent slots before any other recurrence logic. Phrase-first,
atomic, non-interruptible. Cleared at every section boundary.

---

## 8. Punctuation (readable path only)

Applied as a post-pass over a finished word array. It mutates only the
CHARACTERS of existing atoms — it NEVER adds or removes array entries, so any
count-exact caller stays exact. Zero PRNG draws when all three punctuation dials
are 0. Resolution order: quotation, then scare quotes, then commas (so they do
not fight for the same word edge).

- **Quotation** — needs ≥ 4 words and `next()<quotation`. Choose a 2–4 word span
  (draws), wrap its edges in `"`, and set the word just before the span to a
  cast name (the speaker).
- **Scare quotes** — needs ≥ 2 words and `next()<scareQuotes`. Wrap one interior
  word in `"` if unclaimed.
- **Commas** — needs ≥ 3 words. Walk interior positions; a comma prefers to sit
  just before a function word (draw against `commas`), else falls back to
  rhythmic placement in the middle band with a minimum gap since the last comma
  (draw against `commas·0.35`). Never on the last word, a claimed edge, or two
  in a row. **No semicolons** — ortho has no clauses for them to legitimately
  join.

---

## 9. Output surfaces

- `word(n, contractions?)` → one string.
- `sentence(numWords, maxLetters)` → array of word-strings; first word
  capitalized, terminal mark on the last. Recurrence + punctuation applied.
- `paragraph(numSentences, maxWords, maxLetters)` → flat array across sentences.
- `page(numParagraphs, …)` → array of paragraphs (each a word array); a section
  boundary.
- `tokens(n, maxLetters=8)` → EXACTLY `n` word-atoms, in order. Recurrence
  applies; punctuation NEVER does. This is the harness contract and the cleanest
  vector-diff path.
- `render(structure, {wordSep=" ", paraSep="\n\n", indent=""})` → display string.
  Formatting only: no PRNG, no token changes. Line breaks live here because the
  structure already carries the boundaries.

---

## 10. Invariants (must hold on every host)

1. **All-zero baseline.** With all seven dials at 0, output is byte-identical to
   the golden vectors. All-zero paths make zero recurrence/punctuation draws.
2. **Determinism.** Same seed + same dials → identical output, every run,
   every host.
3. **Count-exact.** `tokens(n)` returns exactly `n` atoms for every `n ≥ 0`,
   at any dial setting.
4. **Bare tokens.** `tokens()` output never contains `"` or `,` regardless of
   punctuation dials.
5. **Cross-host identity.** Same seed → identical `tokens` stream in JS, C,
   Max, and oF. Proven by vector diff.
6. **≥ 2-letter recurrence.** Every recurring term (name, topic, phrase word) is
   at least two letters.

---

## 11. Golden vectors

`test/vectors/vN/seed_<seed>.txt`, one atom per line as `<index>\t<word>`,
produced by `tokens(seed, n)` with all dials 0. These are the portable contract.
Each conforming host has a test that regenerates and diffs against them; a clean
diff is the definition of "coherent with the reference." Vectors are versioned:
a deliberate algorithm change is a new vector set and a spec-version bump, never
a silent edit.

---

## 12. Repo constellation

- **`ortho`** (this repo) — reference implementation, spec (this file), golden
  vectors, and the web / ScriptHub host. The authority.
- **`ortho-kernel`** — a shared, host-neutral C implementation. It exposes a
  C API implementing this specification: caller-owned memory (the kernel never
  allocates), value-returning calls (no callbacks), and a token type carrying
  text plus source classification. No host types appear in the public API.
  Included as a git submodule by the two C/C++ hosts.

  *This specification defines behavior, not file layout.* Any implementation
  that conforms to the vectors and invariants is a conforming implementation,
  whatever its language or directory structure.
- **`ortho-max`** — Max external. Glue over `ortho-kernel`; the seven dials are
  attributes/messages. Tests against this repo's vectors.
- **`ortho-of`** — openFrameworks add-on (`ofxOrtho`). Thin C++ wrapper over the
  same `ortho-kernel`; the seven dials are setters. Tests against this repo's
  vectors.

Version tracks *the language*, not the host: when the algorithm changes, all
repos move to the same spec version together. Consolidation into a monorepo
later is just relocating already-conformant parts under one roof.
