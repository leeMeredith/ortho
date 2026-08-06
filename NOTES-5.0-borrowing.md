# borrowed stratum — design in progress

Status: design decisions settled, nothing prototyped. Intended to land in
the same spec bump as function-word erosion (see
NOTES-4.0-function-words.md).

## The idea

A language borrows content vocabulary from a donor with different
phonotactics. Adoption is audible precisely because the donor's rules
differ — `garage` and `rendezvous` feel foreign in English because French
leaves residue English does not otherwise produce. Obvious difference is
the mechanism, not a compromise.

Native function words (worn, per 4.0) against borrowed content vocabulary
is the English/French texture: English took French nouns, verbs and
adjectives wholesale and essentially no grammar.

## Settled

**Donor is a second root template plus partially-disjoint inventory,
drawn at substrate time.** A language's donor does not change mid-document.

**Structural distance from the native template is required and testable.**
Cluster admissibility is the most audible axis: a CVCV language contains no
clusters at all, so a borrowed word carrying one sticks out exactly as
wanted. Reject a donor whose profile is too close to the native one and
draw again.

**One loan layer, not two.** Real languages have both a nativised old layer
(`chair`, fully assimilated) and a recent unassimilated one (`garage`,
still unstable). Nativisation is erosion applied to a loan, so the
machinery exists — but it doubles complexity for a small audible gain.
Recent-only.

**Borrowed words are marked.** §11's vector format is already
`<index>\t<word>\t<source>`, so `borrowed` is another value in an existing
column. No format change, and the conformance diff starts asserting WHICH
words are loans. A port borrowing at the right rate on the wrong words
fails — pure texture could never catch that.

**Loans are barred from function words as a consequence, not a rule.**
Erosion defines function words as worn NATIVE material. If loans could
reach them the two rules would compete for the same words and neither
layer would be identifiable. One less rule to state and port.

**Loans reach names.** §5.3 is just word() plus a length draw and
title-casing, so names inherit borrowing automatically with no separate
mechanism. Matches the real pattern: English personal names are
overwhelmingly foreign (John, Mary, Michael from Hebrew via Greek and
Latin; William, Robert, Richard Norman French), with native Anglo-Saxon
stock a minority.

**Rate is drawn at substrate time, NOT a dial.** Precedent is `compounds`
(§4.2 step 8): a substrate property that changes what word() produces with
no dial attached. Reasons against a dial:

- Both §6 families are recurrence and decoration. Neither creates
  vocabulary. Borrowing creates words.
- `preset` fills all dials with tuned proportions, so an eighth would take
  a preset share — turning `preset` up would silently make every language
  more contact-influenced. Borrowing is a property of the language, not of
  how ornamented the output is.
- No §6 change, no preset interaction, no eighth entry in three hosts'
  attribute tables.

Cost: no runtime control of borrowing on a given language. Correct, given
that a seed names a fixed language forever.

## Open

- Do place-style and given-style names differentiate? Real pattern splits
  them: personal names heavily borrowed, place names heavily native (English
  river names are Celtic; surnames are transparent native compounds —
  Smith, Baker, Underhill). ortho has one undifferentiated names table.
  Deferred; may not be worth splitting.
- Multiple donors with unequal weight is closer to real English (French
  heavy, Latin and Norse lighter). Small mechanical extension — draw two or
  three donors, assign shares, pick by weight per borrowed word. Risk: with
  enough donors the language stops having a recognisable native shape and
  becomes noise. Would need a cap on total borrowed proportion regardless
  of donor count.
- How the donor inventory relates to the native one. "Partially disjoint"
  is not yet a rule.
- Where in §4.2's draw order the donor is drawn.
- Whether a pidgin-like reduction is a separate object worth having. A
  pidgin is a contact language with no native speakers: reduced grammar,
  vocabulary from one dominant source, phonology simplified. That is
  REDUCTION, same family as erosion, where borrowing is addition. A small
  inventory + short template + heavy erosion may already produce it by
  accident. Worth listening for before designing anything.

---

# Reach — donor distance derived from the substrate

Supersedes the open question "how distant is the donor." Distance is not a
free parameter; it follows from the language's own range.

## The measure

**Reach** is derived from what §4.2 already established — inventory sizes
(6–20 consonants, 4–6 vowels), template cut-count, cluster admissibility.
No new draw, no draw-order change. It falls out of the language rather than
being imposed on it.

A CVV language with 6 consonants and 4 vowels has low reach: few shapes, no
clusters, two cut points. A CCVCV language with 20 consonants has high
reach.

## The rule

**High reach borrows far. Low reach borrows near.**

Distance scales DIRECTLY with reach, not inversely. A small language
selects a donor close to what it already inhabits; a large one reaches for
severity.

## Why this way round

The inverse — poor languages reaching furthest to fill gaps — is the
intuitive version and it is wrong twice over.

Empirically: small languages under pressure are conservative, not
adventurous. Icelandic coins from native roots rather than importing
(tölva for computer, built from native material instead of taking the
Latin). Precarity produces purism. English borrows omnivorously — tsunami,
shampoo, chocolate — because a dominant, secure language has nothing to
lose by it. Prestige licenses distant borrowing.

Mechanically: under the inverse rule the poorest languages get the loudest
loans. A CVV language with 6 consonants would carry heavy clusters from a
distant donor — the most conspicuous possible signal in the language least
able to absorb it. That reads as breakage, not contact.

## What it composes into

Two recognisably different kinds of language from one rule:

- Low reach + worn function words + near donor → tight, internally
  consistent, plausibly the pidgin-adjacent object noted above.
- High reach + distant donor → sprawling, layered, audibly multi-stratum.

## Consequence to accept

Borrowing behaviour is fully determined by phonology. A rich language that
happens to borrow lightly is not expressible. Real English is arguably that
case. The rule is explanatory rather than merely generative — worth it, but
it is a real constraint.

## Still open here

- The distance metric itself. Cluster admissibility is the most audible
  axis, but "far" needs a definition over the ten templates before anything
  can be prototyped.
- Whether reach also scales the RATE of borrowing, or only the distance.
  Currently only distance; rate is a separate substrate draw.

---

# Contact under force — deferred, not part of this design

A distinct language TYPE, not a parameter on reach. Recorded here so the
reasoning survives; not to be built with the rest.

## The case

Reach describes CHOSEN borrowing: a language selects a donor at a distance
its own range licenses. Contact under force is not selection — the donor is
imposed, and the language's only move is assimilation.

Hawaiian is the type case. Extreme low reach: 8 consonants, 5 vowels,
strictly CV, no clusters, no final consonants. Under sudden contact it did
not borrow near, because no near donor existed. It borrowed from English
and hammered the loans into native shape — Kalikimaka from Christmas, kaʻa
from car, pipi from beef. Every cluster broken up, every final consonant
given a vowel.

This is not a counterexample to reach. It is a different mechanism, and it
needs its own rule.

## The correction worth keeping

Nativised loans do NOT stick out — that is what nativisation means. A
Hawaiian speaker does not hear kaʻa as foreign. So if the goal is loans
that protrude in a low-reach language, assimilation is the wrong mechanism.

What does protrude is PARTIAL nativisation, unevenly applied: most loans
hammered flat, a minority resisting — typically the recent, high-frequency,
or prestige-marked ones. That leaves a small subset carrying donor shapes
the language otherwise forbids, against a background of loans gone native.
Genuinely conspicuous.

## Shape it would take

Sudden imposition; high rate; distant donor REGARDLESS of reach; most loans
nativised; a minority left raw. A seed would draw whether it is this type.

## Why deferred

Nativised-vs-raw is two layers under another name, so this partly reopens
the one-layer decision settled above. Too large to carry alongside erosion
and the base borrowed stratum. Revisit once both have landed and been
heard.

---

# Template distance metric — settled

Closes the open item "the distance metric itself." Operates on the ten
templates of §4.2 step 1. No PRNG, no engine dependency.

## Features per template

Scanning adjacent slot pairs:

- onsetC  — consonant cluster at position 0
- codaC   — consonant cluster ending the template
- medialC — consonant cluster elsewhere
- vv      — adjacent vowel slots
- len     — template length
- vinit   — 1 if vowel-initial
- cfin    — 1 if consonant-final

Distance is the weighted sum of absolute differences:
onsetC x3, codaC x3, medialC x2, vv x2, len x1, vinit x1, cfin x1.

## Why position matters

The first metric counted only HOW MANY clusters a template has, not where.
That scored CCVC <-> CVCC and CCVCV <-> CVCCV at 0 — treating onset and
coda clusters as identical. They are among the most audible distinctions
available: `bta` and `tab` are not the same shape, and English tolerates
coda clusters far more readily than exotic onsets. Distance 0 there was
wrong, not merely imprecise.

Adding position fixed the range as well. Old metric: values 0-6, six pairs
tied at the maximum. New: values 2-8, no ties at zero, useful spread.

## Result

Most distant: CVCC <-> CCVCV at 8 (coda-cluster against onset-cluster).
Then seven pairs at 7, including CVV <-> CCVC — which was the instinct this
was built to check, and it lands near the maximum.

Full table, each template's donors sorted nearest first:

  CVCV   CVC:2 CVCVC:2 VCVC:2 CVCCV:3 CVV:3 CVVC:3 CCVC:4 CVCC:4 CCVCV:4
  CVC    CVCV:2 CVCVC:2 VCVC:2 CVV:3 CVVC:3 CCVC:4 CVCC:4 CVCCV:5 CCVCV:6
  CCVC   CCVCV:2 CVCV:4 CVC:4 CVCVC:4 VCVC:4 CVVC:5 CVCC:6 CVCCV:7 CVV:7
  CVCC   CVCV:4 CVC:4 CVCVC:4 VCVC:4 CVVC:5 CCVC:6 CVCCV:7 CVV:7 CCVCV:8
  CVCVC  CVCV:2 CVC:2 VCVC:2 CVCCV:3 CVVC:3 CCVC:4 CVCC:4 CCVCV:4 CVV:5
  CCVCV  CCVC:2 CVCV:4 CVCVC:4 CVCCV:5 CVC:6 VCVC:6 CVV:7 CVVC:7 CVCC:8
  VCVC   CVCV:2 CVC:2 CVCVC:2 CVVC:3 CCVC:4 CVCC:4 CVCCV:5 CVV:5 CCVCV:6
  CVCCV  CVCV:3 CVCVC:3 CVC:5 CCVCV:5 VCVC:5 CVV:6 CVVC:6 CCVC:7 CVCC:7
  CVV    CVVC:2 CVCV:3 CVC:3 CVCVC:5 VCVC:5 CVCCV:6 CCVC:7 CVCC:7 CCVCV:7
  CVVC   CVV:2 CVCV:3 CVC:3 CVCVC:3 VCVC:3 CCVC:5 CVCC:5 CVCCV:6 CCVCV:7

## Minimum donor distance: 3

Distance 2 donors are too similar for loans to register. The floor is
expressed as a THRESHOLD, not a rank ("skip the nearest").

Rank fails: CVCV, CVC, CVCVC and VCVC each have three donors tied at 2, so
"second nearest" is undefined. Any tiebreak would be arbitrary and would
have to be specified identically in C. A threshold is one number and one
sentence.

Effect of a floor of 3:
- CCVC and CCVCV are each other's only distance-2 donor; next is 4. Pushed
  straight to 4.
- CVV's only 2 is CVVC; next is 3. Clean.
- CVCC has no donor at 2 at all — nearest is 4. Already isolated;
  unaffected.

Interacts with reach: a low-reach language borrowing near now lands at 3,
which is where loans start being discernible.

## Still open

The mapping from reach to distance. Does reach select a target distance and
take the nearest match, or select a band and draw within it? Taste
question; the table cannot answer it. This is the last item before a
prototype is possible.

---

# Two distance axes — measured, and reach needs rethinking

## The problem this solves

Template distance alone has a ceiling that varies by template. The four
cluster-free templates top out at 4, 6, 5, 6 (CVCV, CVC, CVCVC, VCVC);
cluster templates reach 7 and 8. So distant borrowing appeared to be
available only to languages that already have clusters — which cuts against
reach, since reach is about inventory size and cut-count, not cluster
presence.

Resolution: the donor is a template PLUS a partially-disjoint inventory.
Distance is two-dimensional. A CVCV language whose donor is also CVCV but
built from consonants it barely uses produces loans that are structurally
native and phonemically foreign — the shape does not protrude, the letters
do. Real pattern: Japanese loans from English keep Japanese syllable
structure but introduced phonemes that did not exist natively.

## Measured over 300 seeds

Canon is 20 consonants, 6 vowels.

  nCons  langs  unused consonants  unused vowels
      6     21                 14              1
      7     11                 13              1
      8     24                 12              0
      9     11                 11              2
     10     25                 10              2
     11     27                  9              2
     12     24                  8              1
     13     17                  7              1
     14     16                  6              2
     15     20                  5              2
     16     23                  4              0
     17     18                  3              2
     18     16                  2              2
     19     22                  1              0
     20     25                  0              2

124/300 languages have fewer than 6 unused consonants. 25 sit at exactly
20 — no disjoint donor possible at all.

## The axes are complementary, not competing

Phoneme distance is anti-correlated with inventory size: 6 consonants
leaves 14 spare, 20 leaves none. Small inventory is also low reach by the
current definition. So languages that cannot reach far by SHAPE are exactly
the ones that can reach far by PHONEME, and vice versa. Each language has
one axis genuinely open to it.

Better than the design needed — but it breaks reach as written.

## Reach must be rethought

Reach was "inventory size plus template cut-count scales donor distance."
If small-inventory languages have the most phonemic room, reach cannot
simply be LOW for them. It has to describe which currency a language
spends, not how much it has.

Not resolved here. This is the open question to return to.

## Vowel disjointness is unavailable

Canon of 6, nVow = 4 + below(3), so unused vowels range 0-2 and several
inventory sizes show 0. There is no reliable vowel disjointness. Phoneme
distance is a CONSONANT-ONLY device. State this in the spec rather than
letting a port discover it.

## Caveat on the measurement

The unused column is derived from nCons alone: it shows HOW MANY letters
are free, not WHICH. Two languages with 10 consonants may have quite
different spare sets. Fine for a donor drawn purely from unused letters. If
the rule ever becomes "donor shares some and differs in others," the
overlap between specific sets matters and this table does not describe it.

## Also unresolved from the banding work

Rank-thirds banding produced bands split mid-tie — CVCC has near at 4,4,4
and mid opening at another 4, so which third a donor lands in is decided by
sort order rather than distance. Arbitrary, and would have to be specified
identically in C. Two candidate fixes, neither adopted:

- Absolute bands (near 3-4, mid 5-6, far 7+) with clamping to the nearest
  non-empty band. Makes CVCV languages incapable of distant borrowing by
  template — possibly correct, since the metric says no distant relative
  exists.
- Two bands rather than three, split at 5. Fewer boundaries, fewer places
  for a tiebreak to matter. Less expressive, much easier to port.

Both may be moot now that phoneme distance is in play.

---

# Constraints inherited from shipped 4.0

Written after 4.0 landed across all four repos. These were learned during the
port, AFTER the design decisions above, and none of them were known when those
decisions were made. Read this before prototyping.

## The source column is nearly full

`test/oracle.js` documents the encoding:

    0 fresh   1 functionWord   2 topic   3 name   4 phrase

"Loans marked in the existing <source> column" was settled above, but the
column is a CLASSIFICATION, not a flag set. A borrowed name would need to be
both 3 and borrowed. Three options, none chosen:

- A sixth value, `5 borrowed`, which loses the name/topic/phrase distinction
  for loans.
- A separate bit or byte alongside `source`, which changes the vector line
  format `<index>\t<word>\t<source>` and therefore every host's oracle.
- High-bit flagging on the existing byte (C stores it as `uint8_t
  last_source`), which preserves the format at the cost of readability.

## Invariant 1 constrains the marking

§10 invariant 1: with all dials at 0, output is byte-identical to the vectors
and all sources are FRESH. `conformance.js` asserts this directly:

    new Ortho(11).tokensWithSource(60).every((t) => t.source === SRC.FRESH)

A loan generated at zero dials is still fresh — it was not recurred. So
`borrowed` cannot simply replace FRESH, or that invariant breaks. This is the
strongest argument for a flag alongside `source` rather than a sixth value.

## Draw-order placement

§4.2 has fourteen steps; step 14 (function words) is LAST, and 4.0 confirmed
`_buildFunctionWords` is the final statement of `_buildSubstrate()`. A donor
drawn as step 15 leaves steps 1–14 byte-identical. A donor drawn earlier shifts
everything after it.

But loans reach content vocabulary generated at RUNTIME, not just substrate
tables, so v6 vectors will diff broadly regardless. The step-15 placement buys
a clean substrate, not a clean diff.

## Erosion already reserved the space

§5.7's pattern tops out at cut index 2, so a four-cut language never produces
its full root as a function word. That was deliberate and it was for THIS —
the top of each language's range is reserved for content vocabulary, which is
where loans land. Do not undo it.

Also: §5.4 now ends "Function words are worn NATIVE material by construction.
Nothing else in the language may claim them." That sentence is the loan bar.
It is already in the shipped spec, so 5.0 does not need to add a prohibition.

## The C signature resists new parameters

`ortho_word(o, num_letters, allow_contractions, out)` is public in `ortho.h`
and called from six sites. 4.0 needed two new arguments and did NOT add them —
it added a static `ortho_word_cut(o, cut, no_clusters, out)` instead, plus an
`o->no_clusters` field on the struct, because the header is the shared contract
and both hosts vendor it flat.

Borrowing will want the same treatment: a separate entry point and per-instance
state, not a wider public signature.

Note also that transient internal state goes IN `ortho_t` (there is precedent:
`last_source`, `no_clusters`, `bounds`), never file-scope static. 4.0 shipped a
static first and it was moved before release specifically so the kernel stays
reentrant across instances.

## Vectors cannot prove borrowing works

The lesson 4.0 taught twice. Vectors record CHANGE, not correctness — spec 3.0's
function-word collapse passed every vector on every host because each host
reproduced it faithfully. Two bare seeds even passed the 4.0 regeneration
because 50 tokens at zero dials never reached their function words.

§10 invariant 7 exists for exactly this reason. Borrowing needs its own content
invariant, decided BEFORE implementation. Candidate: every word marked borrowed
conforms to the donor template and no word marked native does.

Caveat on invariant 7 worth knowing: 54 of 300 languages passed it under 3.0
anyway, because `clusterGuard` incidentally shortened some full-root words and
produced a second length by accident. A content invariant can be weaker than it
looks. Check what a candidate invariant does against the PREVIOUS spec before
trusting it.

## Process, if a fresh session picks this up

Every 4.0 decision was measured before it was made — draw counts, legal cut
positions, duplicate rates, distance tables — and heard across thirty seeds
before it was written. Two options that sounded right on paper (universal
cluster suppression; rank-based donor bands) failed only when printed. Print
first.
