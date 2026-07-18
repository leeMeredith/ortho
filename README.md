# ortho

> **The authority for what ortho *is* lives in [`SPEC.md`](./SPEC.md).**
> This README is the tour; the spec is the contract every host conforms to.

A generator for *invented language* — pseudo-words with the uncanny quality of
text you can almost read but don't belong to. One `Ortho` instance builds a
persistent language substrate (consonants, vowels, digraphs, trigraphs,
contractions) once from a seed, then draws every word from that same substrate
for its lifetime. Same seed → same language, reproducibly.

This repo is the **reference implementation**. A Max/MSP external (`ortho`)
mirrors this logic in C; the two are kept in lockstep via a shared PRNG and a
golden-vector harness (see below).

## Two APIs

**Readable / creative** — structure-controlled, human-facing:

```js
const { Ortho } = require("./src/index");
const o = new Ortho(12345);        // reproducible language; omit seed for fresh
// dials via opts: new Ortho(12345, { preset: 0.4 })  — or set any individually

o.word(6);                          // one word
o.sentence(5, 8);                   // array of words, capitalized + punctuated
o.paragraph(3, 8, 8);              // flat word array across sentences
o.page(3);                          // array of paragraphs
```

**Harness / neutral** — count-exact substrate for stress-testing intake:

```js
o.tokens(1000);                     // EXACTLY 1000 word-atoms, in order
```

`tokens(n)` only decides *what* the atoms are, never *how* they are released in
time. Intake drivers (paste vs. type vs. corridor-spawning) are deliberately
**not** built yet — they are Phase 4, blocked on the ScriptHub intake interface
being real enough to build against. Designing them in a vacuum would bake in
wrong assumptions.

## Recurrence: the two-tier lexicon

Real text has a skeleton of repetition — the same names recur, the same
function words appear constantly, a passage seems *about* something. The
`repetition` dial (0–1) weaves that skeleton in:

Seven **isolated dials** (each 0..1, default 0) plus a one-knob `preset`:

```js
new Ortho(42, { preset: 0.4 });                 // onramp: distributes all seven
new Ortho(42, { names: 0.5, commas: 0.3 });     // or tune individually
new Ortho(42, { preset: 0.4, commas: 0 });      // explicit opts override preset
```

Recurrence family — **phrases** (multi-word units, phrase-first atomic),
**functionWords** (grammar-glue, document scope), **topics** (the phony *what*,
section scope), **names** (the phony *who*, section scope). Punctuation family
(readable path only) — **commas** (function-word-anchored, rhythmic fallback),
**quotation** (speaker-anchored span), **scareQuotes** (single term).

`page()` is a section boundary; `newSection()` forces a subject change. All
recurring terms are at least 2 letters.

With **all seven dials at 0** (the default) the engine is **byte-identical** to
the frozen golden vectors — no extra PRNG draws — so "off" genuinely means off
and the harness baseline is stable. `tokens()` stays bare regardless of the
punctuation dials, so the count-exact harness path is never polluted.

The `preset` macro lives in the JS/glue layer, not the kernel: it just fills
the seven values with tuned proportions. The kernel stays a pure seven-dial
contract, mirrored identically across ScriptHub (JS), Max, and openFrameworks.

## CLI

```
node demo/cli.js --seed 12345           one paragraph
node demo/cli.js --seed 12345 --page 3  three paragraphs
node demo/cli.js --seed 12345 --tokens 20
```

## Harness

`test/oracle.js` dumps `tokens(n)` for a seed, one atom per line, prefixed by
index — the deterministic, structure-free path. The C external runs the
equivalent and the two outputs are `diff`ed; any divergence is a port bug.
Golden vectors for several seeds (including 0 and uint32-max) live in
`test/vectors/`.

```
node test/oracle.js 12345 100 > /tmp/js.txt
# ortho_oracle 12345 100 > /tmp/c.txt      (C side, later)
# diff /tmp/js.txt /tmp/c.txt
```

## What changed from the original single-file script

This is a clean refactor of the original `random paragraph` script. Fixes, all
under a fix-and-improve mandate (correctness *and* richer output), kept
deterministic so the harness has a stable baseline:

1. **Missing `b` restored** — alphabet is now the full 26 letters.
2. **Vowel-digraph table** — the original inner loop overwrote one index every
   pass, collapsing the table to ~5 entries; now all vowel pairs survive.
3. **Contraction indexing** — no longer indexed by consonant count against a
   differently-sized array; draws are always in-bounds.
4. **`new repStrAdd()` / `new repStrSlice()`** — these treated plain functions
   as constructors; now ordinary pure helpers.
5. **Seeded PRNG** — all randomness routes through Mulberry32 (`src/prng.js`),
   the same algorithm the C engine uses, so output is reproducible and
   portable.
6. **No globals, no I/O** — the substrate lives on the instance (mirrors
   `t_ortho` in C); no `console.log`, no `alert`. Only `demo/cli.js` touches
   stdout.

All four word "mix modes" (forward/reverse × consonant-first/vowel-first) are
**kept on purpose** — the irregularity is what makes the output read as a
found language with its own morphology rather than a designed template.

## Roadmap

- **Phase 1 (done)** — JS reference implementation: substrate, seeded PRNG,
  word/sentence/paragraph/page/tokens, two-tier recurrence with phrase-first
  atomic phrases, and speaker-anchored punctuation. Deterministic; count-exact
  on the `tokens` harness path; every dial at 0 reproduces the frozen vectors.

- **Phase 2 — C port, built as a SHARED HOST-NEUTRAL KERNEL.** `prng.c/h` and
  `ortho_engine.c/h` port the JS logic verbatim. **Design constraint (locked):**
  the engine's public C API returns host-neutral C data only — arrays of C
  strings plus counts — and never references host types (no Max `t_atom`, no
  oF `std::string`) in the core. Host specifics live entirely in glue. This
  makes the same compiled engine serve *both* the Max external and an
  openFrameworks add-on with no core changes.

- **Phase 3 — harness proof.** `ortho_oracle <seed> <n>` diffed against
  `test/vectors/`; zero divergence means the port is faithful.

- **Phase 4 — hosts + intake drivers.**
  - **Max external (`ortho`)** — glue: `@seed`, `@repetition`, `@punctuation`
    attributes (seed saved with patch), `bang`/`tokens N`/`page N`/`section`
    messages, word-list out; substrate in `t_ortho`.
  - **openFrameworks add-on (`ofxOrtho`)** — a thin C++ wrapper class over the
    same C kernel; methods return `std::vector<std::string>`. Idiomatic oF
    packaging (example sketch, `addon_config.mk`) is deferrable.
  - **ScriptHub intake drivers** (paste / type / corridor-spawning) — the point
    where the two hosts diverge most (Max scheduler vs. oF threading), so they
    live in host glue, not the kernel. Blocked on ScriptHub's intake interface
    being concrete enough to build against.

The through-line: the kernel is the valuable, hard, shared part; every host is
a thin glue layer over it. Same engine-before-glue discipline throughout.

## Layout

```
src/prng.js      Mulberry32 — shared PRNG canon (→ prng.c/h)
src/engine.js    substrate + word/sentence/paragraph/tokens (→ ortho_engine.c/h)
src/index.js     public API surface + page()
demo/cli.js      standalone runner
test/oracle.js   seed→output dumper for the C-vs-JS diff harness
test/vectors/    frozen golden outputs
```