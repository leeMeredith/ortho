# ortho — Specification

**Status:** authoritative. This document defines what *ortho* is. The reference
implementation (JavaScript, this repo) conforms to this spec; the Max external
(`ortho-max`), the openFrameworks add-on (`ortho-of`), and the shared C kernel
(`ortho-kernel`) all conform to it too. When an implementation and this spec
disagree, the spec wins and the implementation is a bug.

Coherence across hosts is *proven*, not hoped for: every host that generates
output diffs it against the published golden vectors (§8). Same seed → same
language → byte-identical tokens, on every platform.

**Spec version:** 3.0 · **Vector set:** v4 · **PRNG:** Mulberry32

---

## 1. What ortho is

ortho generates *invented language* — pseudo-words that hold the shape and
internal consistency of a language without belonging to any existing one. A
single ortho instance builds a persistent **language substrate** once from a
seed, then draws every word from
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

Run at construction, immediately after dials are set. **Draw order is
normative** — a host that draws the same values in a different order produces a
different language and fails conformance.

Spec 2.x gave every seed the same phonology: all 26 letters drawn uniformly,
one word shape, one punctuation style. Seeds differed in vocabulary and in
nothing else. Everything in this section exists so that languages can differ
the way real languages do — in which sounds they use, how often, in what
shapes, and with which marks.

### 4.1 Draw helpers

**`weights(n, exponent, mix)`** → cumulative table of length `n`.
For each `i`: `x = (1-mix)/n + mix · next()^exponent`. Sum, then normalise to
a running cumulative array. `mix` blends toward uniform; exponent alone is
insufficient, because over a 4-item set raw random weights already leave one
member holding roughly half the mass.

**`subset(pool, k)`** → `k` distinct characters. Copy `pool` to a working list;
`k` times, draw `below(remaining)` and remove that entry. Order of the result is
the draw order, not the pool order.

**`wpick(cum)`** → index. Draw `next()`; return the first `i` where
`next() < cum[i]`, else `cum.length-1`.

### 4.2 Draw order

1. **Root template.** Draw `below(10)` into this table, in this order:

   | index | shape | consonant-weight bias |
   |---|---|---|
   | 0 | `CVCV`  | 1.0 |
   | 1 | `CVC`   | 1.0 |
   | 2 | `CCVC`  | 1.2 |
   | 3 | `CVCC`  | 1.2 |
   | 4 | `CVCVC` | 1.0 |
   | 5 | `CCVCV` | 1.1 |
   | 6 | `VCVC`  | 0.8 |
   | 7 | `CVCCV` | 1.1 |
   | 8 | `CVV`   | 1.3 |
   | 9 | `CVVC`  | 1.2 |

   The bias multiplies the consonant weight exponent in step 3. Vowel-leading
   and vowel-cluster shapes carry a consonant-favouring bias so the two cannot
   compound into a language that is nearly all vowels.

2. **Phoneme inventory.** `nCons = 6 + below(15)`, then `nVow = 4 + below(3)`.
   Then `consSet = subset(CONSONANTS, nCons)`, then
   `vowelSet = subset(VOWELS, nVow)`.

   Never fewer than 4 vowels: with any lopsided weight a 3-vowel language
   collapses onto one vowel and reads as a stutter.

3. **Letter weights.**
   `vowelW = weights(nVow, 1.4, 0.20 + 0.55·(nVow/6))`, then
   `consW = weights(nCons, 1.4·bias, 0.25 + 0.55·(nCons/20))`.

   Weights **compensate** for inventory size rather than compounding with it.
   Subset and weight are both narrowing devices; at full strength together they
   leave a single letter doing all the work.

4. **Clause mark.** `below(4)` → `[",", ";", ":", "—"]`.
5. **Quote pair.** `below(3)` → `[["\"","\""], ["«","»"], ["‹","›"]]`.
6. **Quoted capitalisation.** `capitalizeQuoted = below(2)==0`.
7. **Terminal marks.** Start `"."`; if `below(2)==0` append `"?"`; if
   `below(2)==0` append `"!"`. Two draws always, regardless of outcome.
8. **Compounding.** `compounds = below(4)==0`.

9. **Vowel digraphs.** Every ordered pair of DISTINCT letters from `vowelSet`,
   nested `i` then `j`, skipping `i==j`. **No PRNG draws.** A doubled vowel is
   a long vowel, not a cluster.

10. **Consonant digraphs** — 30 iterations. Each: draw `a=below(nCons)`, draw
    `b=below(nCons)`; while `a==b` redraw `b`. Push
    `consSet[a]+consSet[b]`.

11. **Consonant trigraphs** — 10 iterations. Each: draw three `below(nCons)`
    into `idx[0..2]`; then de-dupe: for `a` in 0..2, for `b` in 0..2, if `a!=b`
    then while `idx[a]==idx[b]` redraw `idx[b]=below(nCons)`. Push the three
    letters.

12. **Contractions** — 20 iterations. Let `A = consSet + vowelSet` and
    `nA = nCons + nVow`. For `k<5`: draw two `below(nA)`, push
    `"'"+A[a]+A[b]`. For `k>=5`: draw one `below(nA)`, push `"'"+A[a]`.

13. **Names** — build 15 (see §5.3).
14. **Function words** — build 20 (see §5.4).

Steps 10–12 draw from the language's own inventory, not the full canon. In
2.x they drew from all 20 consonants and all 26 letters, so a spliced cluster
could introduce a letter the language never otherwise used.

The substrate tables are immutable for the instance's life.

---

## 5. Word generation

### 5.1 `word(numLetters, contractions=true)`

Produces one word. Draw order (normative):

1. Clamp `n = numLetters`; if `n<=0`, `n=1`.

2. **Particle case.** If `n==1`: draw `below(3)`; if 0 draw a vowel via
   `wpick(vowelW)`, else a consonant via `wpick(consW)`. Return it. No further
   steps.

   Only §5.4 requests length 1. A one-letter FUNCTION word is a particle — the
   equivalent of English *a* or *I* — and languages have them. A one-letter
   CONTENT word is a truncation artifact, which is why step 4 floors everything
   else at one whole root.

3. **Compound decision.** If `compounds` and `n>=6`, draw `below(3)`; on 0 the
   word is `run(ceil(n/2)) + "-" + run(floor(n/2))`. Otherwise `run(n)`.

   A compound is word FORMATION, not punctuation: it is a single token and
   appears on the `tokens` path like any other word.

4. **`run(len)`.** Repeat the root template `max(1, round(len / rootLength))`
   times to get a slot string. Walk it left to right:

   - **Vowel slots.** Count the adjacent run. If 2 or more and `vowelDigraphs`
     is non-empty, draw `below(len(vowelDigraphs))`, append that pair, advance
     2. Otherwise `wpick(vowelW)`; if the result equals the last character
     emitted, `wpick(vowelW)` once more; append, advance 1.
   - **Consonant slots.** Count the adjacent run. If 3 or more, draw
     `below(10)` from `consonantTrigraphs`, append, advance 3. Else if 2 or
     more, draw `below(30)` from `consonantDigraphs`, append, advance 2.
     Otherwise `wpick(consW)` with the same single redraw rule; advance 1.

   The single redraw is not a loop: a 6-consonant language would otherwise
   spin. It exists because a doubled letter at a slot boundary reads as a
   stutter rather than as a geminate.

5. **Contraction.** If `contractions` and `below(4)==0`, append a contraction
   (draw its index via §5.5).

6. **Cluster guard** (§5.6). Consumes no draws.

**Removed in 3.0: positional digraph/trigraph injection.** Spec 1.x and 2.x
spliced clusters over a finished word at fixed length bands. That existed
because it was the only path by which a seed's own tables reached a word. It
now has three better ones — template, inventory, weights — and its remaining
effect was to append clusters to templates that forbid them, so a `CVCV`
language produced words like `rirgh`. Clusters now fill the slots that permit
clusters, which means a `CVCV` language correctly has none at all, exactly as
Hawaiian has none.

**Also removed: the four mix modes and the vowel/consonant split.** The
template decides structure. The modes existed to introduce irregularity into
an otherwise uniform assembler; the substrate now supplies that irregularity
at the level of the language rather than the word.

### 5.2 String helpers

- `insertAt(s, add, i)` → `s[0..i] + add + s[i+1..]`
- `spliceRange(s, add, from, to)` → `s[0..from] + add + s[to..]`

Pure functions. (The reference's history had these misused as constructors;
they are ordinary functions.)

### 5.3 Names (15, built at substrate time)

For each: draw `ranTest=below(10)`; if `<3`, `ranTest=5`. Generate
`word(ranTest, contractions=false)`, title-case the first letter. Names are
capitalized; they carry the section's identities.

### 5.4 Function words (20, built at substrate time)

A growing size counter starting at **1**, incremented every `floor(20/4)=5`
words. Each: `word(size, contractions=false)`. These are the grammar-glue.

Starting at 1 rather than 2 is what gives a language its particles. See §5.1
step 2.

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
| `topics` | section | the section's subject recurring |
| `names` | section | the section's identities recurring (capitalized) |

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

**The dials decide how often a mark appears; the seed decides which mark it
is.** `commas 0.4` in a semicolon language produces semicolons. The seven dial
names are frozen vocabulary across every host and do not change.

- **Quotation** — needs ≥ 4 words and `next()<quotation`. Choose a 2–4 word span
  (draws), wrap its edges in the language's `quotePair`, and set the word just
  before the span to a cast name (the speaker). If `capitalizeQuoted`, the
  first word inside the span is title-cased before the mark is attached.
- **Scare quotes** — needs ≥ 2 words and `next()<scareQuotes`. Wrap one interior
  word in the language's `quotePair` if unclaimed. Never capitalised: a scare
  quote holds a term at arm's length rather than reporting speech.
- **Commas** — needs ≥ 3 words. Walk interior positions; the language's
  `clauseMark` prefers to sit just before a function word (draw against
  `commas`), else falls back to rhythmic placement in the middle band with a
  minimum gap since the last mark (draw against `commas·0.35`). Never on the
  last word, a claimed edge, or two in a row.
- **Terminal marks** — the last word of a sentence takes one character drawn
  `below(len(terminals))` from the language's own terminal set. Every language
  ends sentences; not every language asks or exclaims in writing.

The clause mark attaches with no space on either side, exactly as the comma did
in 2.x. A spaced dash would read as an English typographic convention rather
than as this language's own mark.

**Host note.** Comma and semicolon are message separators in Max; colon and
dash are not. A language's clause mark therefore decides whether its readable
output survives being pasted into a Max message box. This is documented rather
than compensated for — see HOSTS.md §7.

---

## 9. Output surfaces

- `word(n, contractions?)` → one string.
- `sentence(numWords, maxLetters)` → array of word-strings; first word
  capitalized, terminal mark on the last. Recurrence + punctuation applied.
- `paragraph(numSentences, maxWords, maxLetters)` → flat array across sentences.
  For each of `numSentences` sentences, call
  `sentence(below(maxWords), maxLetters)`. **`maxWords` is drawn below;
  `maxLetters` is passed through unchanged.** Sentence length varies, word
  length does not vary twice.

  Spec 1.x left this unspecified, and every host inherited the reference's
  behaviour of drawing below *both*. Since `sentence` already draws each word's
  length below its own argument, that made word length a doubly-reduced value:
  at `maxLetters` 8 a paragraph averaged two or three letters, below the
  digraph band in step 5, so paragraphs carried no seed-specific material at
  all. Passing `maxLetters` through raises the mean to about 4.8 and keeps
  sentence-length variation, which reads as prose rather than as a list.
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

`test/vectors/vN/seed_<seed>.txt`, one atom per line as
`<index>\t<word>\t<source>`,
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
