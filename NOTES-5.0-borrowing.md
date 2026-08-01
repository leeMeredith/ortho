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
