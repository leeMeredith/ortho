# spec 4.0 — function-word erosion

Status: settled in prototype (/tmp/ortho-fw/e), not yet ported to the
reference. Written before the borrowed-stratum work so the two are
separable if that design changes.

## The defect in 3.0

_buildFunctionWords(20) walked a size counter 1..5, but word() rounds
length up to a whole root, so sizes 2..5 all produced one root. Result:
4 particles then 16 words at exactly root length, no ladder. Sixteen of
twenty function words were phonologically indistinguishable from content
words. The counter was also lopsided (5/5/5/1) and only stable at n=20;
that skew was invisible while the collapse hid it.

## The rule

Function words are short because constant use wears them down. A function
word is a WORN root: build the full root, then truncate at a syllable
boundary. Available lengths fall out of the template rather than being
imposed on it.

Twenty words, built in two groups:

1. Four particles. Unchanged from 3.0 — the n === 1 path in word(),
   one letter drawn from the language's own inventory. NOT derived from
   erosion. Only VCVC can erode to a single letter (a bare V); every
   other template bottoms out at two, so erosion-derived particles would
   exist in one language in eight and be impossible elsewhere.

2. Sixteen eroded roots. word(R.length) with a cut index.

## Cut selection

A cut is legal when both hold:

- TEMPLATE: for a proper prefix of length k, R[k-1] is V, or R[k-1] is C
  and R[k-2] is V. Never mid-onset-cluster. The full root is always legal.
  Cuts of length 1 are excluded — short grammar, never short vocabulary.
- BOUNDARY: the cut lands on a real letter offset. run() records the
  letter offset at each slot boundary as it walks. A digraph fills two
  slots with one unit, so the intermediate slot has no offset and that
  cut does not exist. This is correct: halving a digraph produces a
  cluster the language forbids.

Cut lists are therefore per-language, not per-template — a template's
list depends on whether that language has digraph tables. Measured over
300 seeds: CVCVC gets four cuts, six templates get three, and CCVC,
CVC, CVV get two.

## Which cut each word gets

Pattern [0, 0, 0, 1, 1, 2] indexed by word position mod 6, into the
legal-cut list. Skews short: the most-used words erode most.

The index CLAMPS to the last available cut, never wraps. Wrapping folded
index 2 back onto the shortest cut for the six two-cut templates,
silently reshaping the skew. Clamping preserves the short-heavy intent
everywhere and needs no template-specific rule.

The pattern tops out at index 2, so CVCVC languages never produce their
full root as a function word. Deliberate: it reserves the top of each
language's range for content vocabulary, which matters for the borrowed
stratum later.

## CVV cluster gate

CVV has two adjacent V slots, so the vowel digraph fills both and the
slot-2 boundary vanishes — leaving one legal cut and no ladder at all,
8% of languages. Fix: when the root template is exactly CVV, suppress
cluster tables while building function words, restoring the boundary.

Strictly a cut-enabling rule, not an erosion rule. A universal
suppression was tested and rejected: it does not remove clusters (the
template still demands adjacent C slots) — it fills them from the whole
inventory instead of the language's sanctioned pairs, producing
phonotactic violations.

## Duplicate handling

Erosion draws from a small space at the short end. Measured over 300
seeds before dedupe: 387 duplicates, 264 of them in eroded words.

Rule: when an eroded word matches an existing table entry, redraw once
against the whole table; if it still matches, keep it. A fixed cap,
never a loop — a small inventory would spin.

Result: length-2 duplicates 217 to 42, length-3 46 to 4, ladder shape
unchanged (the retry redraws the same cut). Particles are left alone at
123 duplicates; that path is 3.0 code and duplicate particles read as
scarcity rather than error.

## Draw order and porting

Retries consume stream, so C must hit the collision test at exactly the
same iterations or the streams diverge from that point. Seeds where a
redraw ALSO collides are the sharp case — seed 7 and seed 14 both show
surviving doubles. Conformance vectors should include at least one, so a
port cannot pass while getting retry timing wrong.

Draw counts are unchanged from 3.0 for any language that is not CVV and
where no retry fires. In practice most languages shift, so v5 vectors
diff broadly. That is expected, not a symptom.

_buildFunctionWords is the last statement in _buildSubstrate(), so all
upstream tables are byte-identical to 3.0.

## Not in 4.0

Loanword stratum: a second root template and partially separate
inventory for CONTENT vocabulary, contrasting against natively-marked
function words — the English/French texture, where grammar took no
loans. Runs opposite to erosion (importing foreign shapes vs wearing
native ones down) and would fight it if applied to the same twenty
words. Separate design.
