// engine.js — the ortho language engine.
//
// One Ortho instance = one invented language. The constructor runs the
// substrate build (your original setup()) ONCE into this.tables. Every
// word/sentence/paragraph after that draws from those same tables, so the
// output reads as one consistent fake tongue for the life of the instance.
//
// This file is Max-free and I/O-free on purpose: no console.log, no alert,
// no DOM. It is the reference the C engine (ortho_engine.c/h) mirrors.

import { Mulberry32 } from "./prng.js";

// --- fixed character classes (shared canon with C) -----------------------
// FIX #1: the missing 'b' is restored — full 26-letter alphabet.
const ALPHABET   = "abcdefghijklmnopqrstuvwxyz";
const CONSONANTS = "bcdfghjklmnpqrstvwxz";
const VOWELS     = "aeiouy";

const PUNCTUATION = ".?!";

class Ortho {
  constructor(seed = 0, opts = {}) {
    this.seed = seed >>> 0;
    this.rng = new Mulberry32(this.seed);

    // ---- seven isolated dials (0..1 each) -------------------------------
    // All default 0.0 -> bare output, byte-identical to the frozen golden
    // vectors. Each governs exactly one behavior so a specialized user tunes
    // them independently. In C these are seven float fields; in Max seven
    // attributes / messages; in oF seven setters. Same names across all hosts.
    //
    // recurrence family:
    //   phrases        - multi-word phrase recurrence (phrase-first, atomic)
    //   functionWords  - grammar-glue recurrence (document scope)
    //   topics         - the phony WHAT recurring (section scope)
    //   names          - the phony WHO recurring (section scope)
    // punctuation family (readable path only; tokens() stays bare):
    //   commas         - narrative pacing, function-word-anchored
    //   quotation      - direct speech span, speaker-anchored
    //   scareQuotes    - single term held at arm's length
    const clamp = (x) => Math.max(0, Math.min(1, x || 0));

    // preset macro (glue-level onramp): if provided (>0), distributes tuned
    // proportions across the seven dials. Explicit per-dial opts always win
    // over the preset. Kernel stays pure seven-dial; this is just a helper
    // that fills them. Proportions tuned for a pleasant default character,
    // not a recreation of the old folded ratios.
    const P = clamp(opts.preset);
    const presetVals = P > 0 ? {
      phrases:       P * 0.5,
      functionWords: P * 0.9,
      topics:        P * 0.6,
      names:         P * 0.5,
      commas:        P * 0.8,
      quotation:     P * 0.4,
      scareQuotes:   P * 0.25,
    } : {};

    const pick = (name) =>
      opts[name] !== undefined ? clamp(opts[name])
      : presetVals[name] !== undefined ? clamp(presetVals[name])
      : 0;

    this.phrases       = pick("phrases");
    this.functionWords = pick("functionWords");
    this.topics        = pick("topics");
    this.names         = pick("names");
    this.commas        = pick("commas");
    this.quotation     = pick("quotation");
    this.scareQuotes   = pick("scareQuotes");

    // the current section cast (tier 2). Minted lazily on first use and
    // replaced by newSection(). null = not yet minted.
    this.section = null;

    // phrase-drain queue: when a recurring phrase fires it is pushed here as
    // its individual words; subsequent token slots DRAIN this queue verbatim
    // before any other recurrence logic runs (phrase-first, atomic). Plain
    // instance state — in C this is a small fixed buffer + read index.
    this._phraseQueue = [];

    // the language substrate — built once, reused for this instance's life
    this.tables = {
      vowelDigraphs: [],
      consonantDigraphs: [],
      consonantTrigraphs: [],
      contractions: [],
      names: [],
      functionWords: [],
    };

    this._buildSubstrate();
  }

  // ---- substrate generation (was: setup) --------------------------------
  _buildSubstrate() {
    const rng = this.rng;
    const t = this.tables;

    // vowel digraphs -----------------------------------------------------
    // FIX #2: original inner loop overwrote index rVowD every pass, so only
    // ~5 entries survived (each the last pairing). Now every vowel pair is
    // emitted, giving a real table of VOWELS.length^2 digraphs.
    for (let i = 0; i < VOWELS.length; i++) {
      for (let j = 0; j < VOWELS.length; j++) {
        t.vowelDigraphs.push(VOWELS.charAt(i) + VOWELS.charAt(j));
      }
    }

    // consonant digraphs -------------------------------------------------
    const nConDigraphs = 30;
    for (let k = 0; k < nConDigraphs; k++) {
      let a = rng.below(CONSONANTS.length);
      let b = rng.below(CONSONANTS.length);
      while (a === b) b = rng.below(CONSONANTS.length);
      t.consonantDigraphs.push(CONSONANTS.charAt(a) + CONSONANTS.charAt(b));
    }

    // consonant trigraphs ------------------------------------------------
    const nConTrigraphs = 10;
    for (let k = 0; k < nConTrigraphs; k++) {
      const idx = [
        rng.below(CONSONANTS.length),
        rng.below(CONSONANTS.length),
        rng.below(CONSONANTS.length),
      ];
      // de-duplicate the three positions so no trigraph has a repeat
      for (let a = 0; a < 3; a++) {
        for (let b = 0; b < 3; b++) {
          if (a !== b) {
            while (idx[a] === idx[b]) idx[b] = rng.below(CONSONANTS.length);
          }
        }
      }
      t.consonantTrigraphs.push(
        CONSONANTS.charAt(idx[0]) +
        CONSONANTS.charAt(idx[1]) +
        CONSONANTS.charAt(idx[2])
      );
    }

    // contractions -------------------------------------------------------
    // FIX #3: build a well-defined table and, crucially, index it safely at
    // draw time (original indexed by CONSONANTS.length against a 20-entry
    // array built on ALPHABET.length — in-bounds only by luck). We keep the
    // "first few are two-letter" flavor.
    const nContractions = 20;
    const nDouble = 5;
    for (let k = 0; k < nContractions; k++) {
      if (k < nDouble) {
        const a = rng.below(ALPHABET.length);
        const b = rng.below(ALPHABET.length);
        t.contractions.push("'" + ALPHABET.charAt(a) + ALPHABET.charAt(b));
      } else {
        const a = rng.below(ALPHABET.length);
        t.contractions.push("'" + ALPHABET.charAt(a));
      }
    }

    // names & function words (drawn from the same language) --------------
    this._buildNames(15);
    this._buildFunctionWords(20);
  }

  // draw a contraction safely regardless of table length
  _randomContraction() {
    const t = this.tables.contractions;
    return t[this.rng.below(t.length)];
  }

  // ---- recurrence: two-tier lexicon --------------------------------------
  // Tier 2: mint a fresh section cast — a small fixed set of names and topic
  // words selected/generated ONCE and then REUSED (never regenerated) so the
  // same terms visibly recur. All recurring terms are >= 2 letters. Calling
  // this starts a new "section": new subjects, previous cast discarded.
  // (Later this maps to a Max `section` message, and further out to corridor
  // branches in ScriptHub — a branch introduces new subjects.)
  newSection(numNames = 3, numTopics = 5, numPhrases = 3) {
    // a section boundary ends any in-flight phrase — no bleed across sections
    this._phraseQueue = [];
    const names = [];
    for (let i = 0; i < numNames; i++) {
      names.push(this.tables.names[this.rng.below(this.tables.names.length)]);
    }
    const topics = [];
    for (let i = 0; i < numTopics; i++) {
      let w = "";
      while (w.length < 2) w = this.word(3 + this.rng.below(5), { contractions: false });
      topics.push(w);
    }
    // phrase cast: each phrase is a fixed short sequence (2..4 words) minted
    // ONCE and reused verbatim. Built from the section's own names/topics plus
    // fresh filler, so phrases feel of-a-piece with the passage. Stored as
    // arrays of words; C sees phrases[N][MAXWORDS][MAXLEN], no allocation.
    const phrases = [];
    for (let i = 0; i < numPhrases; i++) {
      const len = 2 + this.rng.below(3); // 2..4 words
      const phrase = [];
      for (let j = 0; j < len; j++) {
        const pick = this.rng.next();
        if (pick < 0.4 && topics.length) {
          phrase.push(topics[this.rng.below(topics.length)]);
        } else if (pick < 0.6 && names.length) {
          phrase.push(names[this.rng.below(names.length)]);
        } else {
          let w = "";
          while (w.length < 2) w = this.word(2 + this.rng.below(4), { contractions: false });
          phrase.push(w);
        }
      }
      phrases.push(phrase);
    }
    this.section = { names, topics, phrases };
    return this.section;
  }

  // Recurrence resolver. Returns a term to emit, or null (caller generates
  // fresh). Order is fixed and identical in C:
  //   1. DRAIN: if a phrase is mid-emission, return its next word. Atomic —
  //      a started phrase always finishes before anything else rolls.
  //   2. SHORT-CIRCUIT: if all four recurrence dials are 0, return null with
  //      zero PRNG draws (queue is only ever loaded when phrases>0). This is
  //      the guarantee that all-zero reproduces the golden vectors.
  //   3. ROLL each dial in fixed order (phrases, functionWords, topics,
  //      names); first hit wins. Each dial rolls independently so they can be
  //      tuned separately. A phrase hit loads the queue and returns word 0.
  // Draw-order note for C: the rolls happen in this exact sequence, each
  // consuming one nextU32 only if the preceding dials didn't already return.
  _recurrentOrNull() {
    // 1. drain (phrase-first, atomic)
    if (this._phraseQueue.length > 0) {
      return this._phraseQueue.shift();
    }
    // 2. short-circuit: all recurrence off -> no draws, vectors intact
    if (this.phrases <= 0 && this.functionWords <= 0 &&
        this.topics <= 0 && this.names <= 0) {
      return null;
    }
    if (this.section === null) this.newSection();

    // 3. independent rolls, fixed order, first hit wins
    if (this.phrases > 0 && this.section.phrases.length &&
        this.rng.next() < this.phrases) {
      const p = this.section.phrases[this.rng.below(this.section.phrases.length)];
      for (let i = 1; i < p.length; i++) this._phraseQueue.push(p[i]);
      return p[0];
    }
    if (this.functionWords > 0 && this.rng.next() < this.functionWords) {
      const t = this.tables.functionWords;
      return t[this.rng.below(t.length)];
    }
    if (this.topics > 0 && this.section.topics.length &&
        this.rng.next() < this.topics) {
      const t = this.section.topics;
      return t[this.rng.below(t.length)];
    }
    if (this.names > 0 && this.section.names.length &&
        this.rng.next() < this.names) {
      const t = this.section.names;
      return t[this.rng.below(t.length)];
    }
    return null;
  }

  _buildNames(n) {
    const t = this.tables.names;
    for (let i = 0; i < n; i++) {
      let len = this.rng.below(10);
      if (len < 3) len = 5;
      let w = this.word(len, { contractions: false });
      t.push(w.charAt(0).toUpperCase() + w.slice(1));
    }
  }

  _buildFunctionWords(n) {
    const t = this.tables.functionWords;
    let size = 2;
    let count = 0;
    const step = Math.floor(n / 4);
    for (let i = 0; i < n; i++) {
      count++;
      if (count === step) { size++; count = 0; }
      t.push(this.word(size, { contractions: false }));
    }
  }

  // ---- string helpers ---------------------------------------------------
  // FIX #4: in the original these were invoked as `new repStrAdd()` etc.,
  // treating plain functions as constructors. Here they are ordinary pure
  // helpers. These map directly to small C string routines.

  // Insert `add` between position i and i+1 of `str`.
  static _insertAt(str, add, i) {
    if (!str || add == null) return str;
    return str.slice(0, i + 1) + add + str.slice(i + 1);
  }

  // Replace the slice [from, to) of `str` with `add`.
  static _spliceRange(str, add, from, to) {
    if (!str || add == null) return str;
    return str.slice(0, from) + add + str.slice(to);
  }

  // ---- word -------------------------------------------------------------
  // Builds one word in this instance's language. Ports the original ratio
  // logic (how many vowels vs consonants for a given length), the four mix
  // modes, digraph/trigraph injection, and contraction sprinkling. All four
  // mix modes are kept deliberately to preserve the "almost-language" feel.
  word(numLetters, opts = {}) {
    const useContractions = opts.contractions !== false;
    const rng = this.rng;

    let n = numLetters | 0;
    if (n <= 0) n = 1;

    // --- decide vowel/consonant split (ported from original) -------------
    let numVowels;
    if (n > 5) {
      numVowels = Math.floor((rng.next() * n) / 2);
      if (n >= n - 2) numVowels = n / 2; // original's wordMaxAddVow branch
    } else {
      const pick = rng.below(2);
      if (pick === 0 && n > 2) numVowels = 2;
      else numVowels = 1;
      if (n <= 3) numVowels = 1;
      if (n === 4 || n === 5) numVowels = 1;
    }
    numVowels = Math.floor(numVowels);
    let numConsonants = n - numVowels;
    if (numConsonants < 1) numConsonants = 1;

    // --- build the vowel and consonant pools ----------------------------
    let vowels = "";
    for (let v = 0; v < numVowels; v++) {
      vowels += VOWELS.charAt(rng.below(VOWELS.length));
    }
    let consonants = "";
    for (let c = 0; c < numConsonants; c++) {
      consonants += CONSONANTS.charAt(rng.below(CONSONANTS.length));
    }

    // --- consonant-heavy path (original numOfVowels==1 && cons>=5) -------
    let word = "";
    if (numVowels <= 1 && numConsonants >= 5) {
      const setIndex = Math.floor(numConsonants / 2);
      word = Ortho._insertAt(consonants, vowels, setIndex);
    } else {
      // --- four mix modes (all kept) ------------------------------------
      const mode = rng.below(4);
      if (mode === 0) {
        for (let m = 0; m < n; m++) {
          if (m < vowels.length) word += vowels.charAt(m);
          if (m < consonants.length) word += consonants.charAt(m);
        }
      } else if (mode === 1) {
        for (let m = 0; m < n; m++) {
          if (m < consonants.length) word += consonants.charAt(m);
          if (m < vowels.length) word += vowels.charAt(m);
        }
      } else if (mode === 2) {
        for (let m = n; m >= 0; m--) {
          if (m < vowels.length) word += vowels.charAt(m);
          if (m < consonants.length) word += consonants.charAt(m);
        }
      } else {
        for (let m = n; m >= 0; m--) {
          if (m < consonants.length) word += consonants.charAt(m);
          if (m < vowels.length) word += vowels.charAt(m);
        }
      }

      // --- digraph / trigraph injection ---------------------------------
      if (rng.below(2) === 0) {
        if (word.length > 9) {
          const tri = this.tables.consonantTrigraphs[
            rng.below(this.tables.consonantTrigraphs.length)
          ];
          if (mode === 0 || mode === 1) {
            word = Ortho._spliceRange(word, tri, word.length - 2, word.length);
          } else {
            word = Ortho._spliceRange(word, tri, 0, 2);
          }
        }
        if (word.length > 5 && word.length < 8) {
          const di = this.tables.consonantDigraphs[
            rng.below(this.tables.consonantDigraphs.length)
          ];
          if (mode === 0 || mode === 1) {
            word = Ortho._spliceRange(word, di, word.length - 1, word.length);
          } else {
            word = Ortho._spliceRange(word, di, 0, 1);
          }
        }
      }
    }

    // --- contraction sprinkling ----------------------------------------
    if (useContractions && rng.below(4) === 0) {
      word += this._randomContraction();
    }

    // --- collapse an accidental leading double letter ------------------
    if (word.length > 3 && word.charAt(0) === word.charAt(1)) {
      word = Ortho._insertAt(word, word.charAt(2), 1);
    }

    return word;
  }

  // ---- punctuation pass (readable path only) ----------------------------
  // Decorates a finished word array in place using three INDEPENDENT dials:
  //   quotation   - a span wrapped in " ", speaker-anchored (needs >= 4 words)
  //   scareQuotes - a single term in " "
  //   commas      - narrative pacing, anchored before function words where
  //                 possible (reads as a clause boundary), rhythmic fallback
  //                 otherwise. No semicolons by design.
  // Mutates only the CHARACTERS of existing atoms — never adds/removes array
  // entries — so count-exact callers stay exact. Costs zero PRNG draws when
  // all three dials are 0 (short-circuit before any roll), keeping vectors
  // intact. Quotation resolves first (claims ranges), then scare quotes, then
  // commas fill remaining gaps, so no two fight for the same word edge.
  _punctuate(words) {
    if (this.commas <= 0 && this.quotation <= 0 && this.scareQuotes <= 0) {
      return words;
    }
    const n = words.length;
    if (n === 0) return words;

    const claimed = new Array(n).fill(false);

    // --- direct quotation: speaker-anchored span ------------------------
    if (this.quotation > 0 && n >= 4 && this.rng.next() < this.quotation) {
      const span = 2 + this.rng.below(3);            // 2..4 words spoken
      const start = 1 + this.rng.below(Math.max(1, n - span - 1));
      const end = Math.min(n - 1, start + span - 1);
      words[start] = '"' + words[start];
      words[end] = words[end] + '"';
      claimed[start] = claimed[end] = true;
      if (this.section && this.section.names.length && start - 1 >= 0) {
        words[start - 1] =
          this.section.names[this.rng.below(this.section.names.length)];
        claimed[start - 1] = true;
      }
    }

    // --- scare quotes: single term, independent of quotation ------------
    if (this.scareQuotes > 0 && n >= 2 && this.rng.next() < this.scareQuotes) {
      // choose an unclaimed interior word if possible
      let i = 1 + this.rng.below(n - 1);
      if (!claimed[i]) {
        words[i] = '"' + words[i] + '"';
        claimed[i] = true;
      }
    }

    // --- commas: function-word-anchored, rhythmic fallback --------------
    // A comma prefers to sit JUST BEFORE a function word (mimics ", and" /
    // ", but" boundaries). Because function words recur, this pattern recurs,
    // reading as a grammatical tic of the language. When the next word is not
    // a function word, fall back to rhythmic placement: middle band of the
    // sentence, minimum gap since the last comma, never doubled, never on the
    // last word or a claimed (quote) edge.
    if (this.commas > 0 && n >= 3) {
      const fset = this._functionWordSet();
      const lo = Math.max(1, Math.floor(n * 0.25));   // middle-band start
      const hi = n - 1;                                // exclusive of last
      let sinceLast = 99;
      for (let i = 1; i < hi; i++) {
        sinceLast++;
        if (claimed[i]) continue;
        const nextIsFunction = fset.has(words[i + 1]);
        // anchored: strong chance right before a function word, anywhere
        // rhythmic: weaker chance, only in the middle band, spaced out
        let hit = false;
        if (nextIsFunction && sinceLast >= 2) {
          hit = this.rng.next() < this.commas;
        } else if (i >= lo && sinceLast >= 3) {
          hit = this.rng.next() < this.commas * 0.35;
        }
        if (hit) {
          words[i] = words[i] + ",";
          sinceLast = 0;
        }
      }
    }
    return words;
  }

  // Lazily-built lookup of this language's function words, for comma anchoring.
  // Cached on the instance; the table never changes after construction.
  _functionWordSet() {
    if (!this._fwSet) {
      this._fwSet = new Set(this.tables.functionWords);
    }
    return this._fwSet;
  }

  // ---- sentence ---------------------------------------------------------
  // Returns an array of word-strings (the caller decides symbol vs list).
  // Terminal punctuation is attached to the last word. When the punctuation
  // dial is on, commas / quotation / scare quotes are woven in (readable
  // path); the atom count is never changed.
  sentence(numWords, maxLetters) {
    let count = numWords | 0;
    if (count <= 0) count = 1;
    const words = [];
    let last = "";
    for (let w = 0; w < count; w++) {
      // recurrence weave: with probability `repetition`, reuse a term from
      // the document glue or section cast instead of generating fresh.
      // Draws nothing from the PRNG when repetition is 0.
      let nw = this._recurrentOrNull();
      if (nw === null) nw = this.word(this.rng.below(maxLetters));
      // if two tiny words land in a row, promote to a function word
      if (w > 0 && w < count - 1 && nw.length <= 1 && last.length <= 1) {
        nw = this.tables.functionWords[
          this.rng.below(this.tables.functionWords.length)
        ];
      }
      if (w === count - 1 && nw.length <= 1) {
        nw = this.tables.functionWords[
          this.rng.below(this.tables.functionWords.length)
        ];
      }
      words.push(nw);
      last = nw;
    }
    // punctuation weave (readable path) — before capitalization/terminal so
    // the first-letter and final-mark logic still see clean word edges.
    this._punctuate(words);
    // capitalize first word, punctuate last
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    const p = PUNCTUATION.charAt(this.rng.below(PUNCTUATION.length));
    words[words.length - 1] += p;
    return words;
  }

  // ---- paragraph --------------------------------------------------------
  // Returns a flat array of word-strings across several sentences.
  paragraph(numSentences, maxWords, maxLetters) {
    let s = numSentences | 0;
    if (s <= 0) s = 1;
    if (maxWords <= 3) maxWords = 7;
    if (maxLetters <= 3) maxLetters = 5;
    const out = [];
    for (let i = 0; i < s; i++) {
      const words = this.sentence(this.rng.below(maxWords), this.rng.below(maxLetters));
      for (const w of words) out.push(w);
    }
    return out;
  }

  // ---- tokens -----------------------------------------------------------
  // Neutral count-exact primitive: return EXACTLY n word-atoms in order,
  // drawn from this instance's language. This is the raw substrate that any
  // future intake driver (paste / type / corridor) will consume — it only
  // decides WHAT the atoms are, never HOW they are released in time. Kept
  // deliberately dumb and exact so it is the cleanest JS-vs-C diff path.
  //
  // maxLetters bounds per-word length so a token stream has natural word
  // variation without any sentence/paragraph structure imposed.
  tokens(n, maxLetters = 8) {
    let count = n | 0;
    if (count < 0) count = 0;
    const out = new Array(count);
    for (let i = 0; i < count; i++) {
      // same weave as sentence(): lets the harness stress "every token
      // unique" (repetition 0) vs "same few terms hammered" (high) — two very
      // different intake pressures. Zero PRNG cost at repetition 0, so the
      // frozen golden vectors remain byte-valid.
      let w = this._recurrentOrNull();
      if (w === null) {
        const len = 1 + this.rng.below(maxLetters); // 1..maxLetters, never 0
        w = this.word(len);
      }
      out[i] = w;
    }
    return out;
  }
}

export { Ortho, ALPHABET, CONSONANTS, VOWELS, PUNCTUATION };