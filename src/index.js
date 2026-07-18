// index.js — public API for the ortho language engine.
//
// Two audiences, two surfaces:
//
//   READABLE / CREATIVE  — structure-controlled, human-facing fake text:
//     .word(len)                 one word
//     .sentence(nWords, maxLen)  array of words, capitalized + punctuated
//     .paragraph(nSent, maxWords, maxLen)   flat array across sentences
//     .page(nParagraphs)         array of paragraphs (each a word array)
//
//   HARNESS / NEUTRAL    — count-exact substrate for any future intake driver:
//     .tokens(n, maxLen)         EXACTLY n word-atoms, in order
//
// One Ortho(seed) == one persistent invented language. seed 0 (or omitted)
// still produces a deterministic language; a saved nonzero seed reproduces a
// language you liked. This is the exact method list the C external exposes as
// messages (bang -> paragraph, `tokens N`, `page N`, `seed N`).

import { Ortho, ALPHABET, CONSONANTS, VOWELS, PUNCTUATION } from "./engine.js";

// page() lives here as a thin composition over paragraph(), so the engine
// core stays focused. A page is an array of paragraphs (each a word array).
//
// A page is also a SECTION boundary: when any recurrence dial is on, each page
// mints a fresh cast of names/topics/phrases, so subjects recur within a page
// and change between pages (document-wide function words, page-scoped subjects).
Ortho.prototype.page = function page(numParagraphs, maxSent = 5, maxWords = 8, maxLetters = 8) {
  let p = numParagraphs | 0;
  if (p <= 0) p = 1;
  const anyRecurrence =
    this.phrases > 0 || this.functionWords > 0 || this.topics > 0 || this.names > 0;
  if (anyRecurrence) this.newSection();
  const out = [];
  for (let i = 0; i < p; i++) {
    out.push(this.paragraph(1 + this.rng.below(maxSent), maxWords, maxLetters));
  }
  return out;
};

// render(structure, opts) — turn structured output into DISPLAY text with
// line breaks. This is a formatting step, NOT generation: it never touches the
// PRNG, never changes tokens, and leaves the harness/token-array paths alone.
// Line breaks live here because the structure already carries the boundaries;
// render just honors them instead of flattening to one feed.
//
// Accepts either a paragraph (array of word-strings) or a page (array of
// paragraphs). Options:
//   wordSep  (default " ")     between words
//   paraSep  (default "\n\n")  between paragraphs (blank line)
//   indent   (default "")      prepended to each paragraph's first line
function render(structure, opts = {}) {
  const wordSep = opts.wordSep !== undefined ? opts.wordSep : " ";
  const paraSep = opts.paraSep !== undefined ? opts.paraSep : "\n\n";
  const indent = opts.indent !== undefined ? opts.indent : "";
  if (structure.length === 0) return "";
  // page = array of paragraphs (arrays); paragraph = array of strings
  const isPage = Array.isArray(structure[0]);
  const paras = isPage ? structure : [structure];
  return paras.map((p) => indent + p.join(wordSep)).join(paraSep);
}

export { Ortho, ALPHABET, CONSONANTS, VOWELS, PUNCTUATION, render };