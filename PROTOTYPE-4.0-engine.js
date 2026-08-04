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

// Token source classification. Values are NORMATIVE and match the C kernel's
// `ortho_source` enum exactly — they travel in the golden vectors (v2+) and in
// the ortho_token struct, so hosts can branch on why a token appeared (e.g.
// ScriptHub spawning a corridor when a new subject shows up).
const SRC = {
  FRESH: 0,     // freshly generated, not recurring
  FUNCTION: 1,  // document-scope function word (grammar glue)
  TOPIC: 2,     // section-scope topic word (the phony WHAT)
  NAME: 3,      // section-scope name (the phony WHO)
  PHRASE: 4,    // member of a recurring multi-word phrase
};

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

    // ===================================================================
    // SPEC 3.0 — the language's own character, minted once, before any
    // word exists. Names and function words are built afterwards from
    // these tables, so a language's cast belongs to it.
    //
    // Spec 2.x gave every seed the same phonology: all 26 letters drawn
    // uniformly, one assembler, one punctuation style. Seeds differed in
    // vocabulary and nothing else, which is exactly what a careful reader
    // reported seeing. Everything below is an axis on which languages can
    // actually differ.
    // ===================================================================

    // --- draw helpers --------------------------------------------------
    // A weighted picker's weights are blended toward uniform by `mix`.
    // Exponent alone cannot control this: over a 4-item set, raw random
    // weights already leave one member holding about half the mass.
    const mkw = (n, e, mix) => {
      const w = [];
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const x = (1 - mix) / n + mix * Math.pow(rng.next(), e);
        w.push(x); sum += x;
      }
      const cum = [];
      let acc = 0;
      for (let i = 0; i < n; i++) { acc += w[i] / sum; cum.push(acc); }
      return cum;
    };
    const subset = (pool, k) => {
      const avail = pool.split("");
      const out = [];
      for (let i = 0; i < k && avail.length; i++) {
        out.push(avail.splice(rng.below(avail.length), 1)[0]);
      }
      return out.join("");
    };

    // --- root template: the shape every word is built from --------------
    // What separates language families before you consider which letters
    // they use. Each carries a bias applied to its consonant weights, so a
    // vowel-leading shape cannot compound with vowel-favouring weights into
    // something that is all vowels.
    const ROOTS = [
      ["CVCV",  1.0], ["CVC",   1.0], ["CCVC",  1.2], ["CVCC",  1.2],
      ["CVCVC", 1.0], ["CCVCV", 1.1], ["VCVC",  0.8], ["CVCCV", 1.1],
      // Vowel-cluster shapes. Adjacent V slots draw a pair from this
      // language's vowelDigraphs, so a CVV language has diphthong-like
      // clusters the way a CCVC language has consonant ones.
      ["CVV",   1.3], ["CVVC",  1.2],
    ];
    const chosen = ROOTS[rng.below(ROOTS.length)];
    t.root = chosen[0];

    // --- phoneme inventory ---------------------------------------------
    // Languages vary enormously here. Hawaiian works with 8 consonants,
    // English with about 24, the crosslinguistic average is near 23. A
    // language using a third of the alphabet repeats those few sounds
    // constantly, and that repetition is most of what makes it recognisable.
    const nCons = 6 + rng.below(15);   // 6-20 of 20
    const nVow  = 4 + rng.below(3);    // 4-6 of 6 — never 3: with any
                                       // lopsided weight a 3-vowel language
                                       // collapses onto one and reads as a
                                       // stutter rather than a tongue
    t.consSet  = subset(CONSONANTS, nCons);
    t.vowelSet = subset(VOWELS, nVow);

    // Weights COMPENSATE for inventory size rather than compounding with it.
    // Subset and weight are both narrowing devices; at full strength together
    // they leave a single letter doing all the work.
    t.vowelW = mkw(nVow,  1.4,              0.20 + 0.55 * (nVow  / VOWELS.length));
    t.consW  = mkw(nCons, 1.4 * chosen[1],  0.25 + 0.55 * (nCons / CONSONANTS.length));

    // --- punctuation character set -------------------------------------
    // The dials decide HOW OFTEN a mark appears; the seed decides WHICH mark
    // it is. `commas 0.4` in a semicolon language produces semicolons. The
    // dial names stay frozen vocabulary across every host.
    //
    // HOST NOTE: comma and semicolon are message separators in Max. A token
    // carrying one re-parses if pasted into a message box; colon and dash do
    // not. A language's clause mark therefore decides whether its readable
    // output is message-box-safe. See HOSTS.md.
    // The dash sits tight against the words on both sides, like a hyphen —
    // a spaced dash would read as an English typographic convention rather
    // than as this language's own clause mark.
    t.clauseMark = [",", ";", ":", "\u2014"][rng.below(4)];
    t.quotePair  = [['"', '"'], ["\u00ab", "\u00bb"], ["\u2039", "\u203a"]][rng.below(3)];

    // Whether quoted speech opens with a capital. Real orthographies differ,
    // and the distinction is legible: a capitalised span reads as an utterance
    // someone said, a lowercase one reads as a term held up for inspection.
    // Since the span is already speaker-anchored — a cast name precedes it —
    // the capital is what completes the effect.
    t.capitalizeQuoted = rng.below(2) === 0;

    // Terminal marks: every language ends sentences, not every language
    // exclaims or asks in writing.
    t.terminals = ".";
    if (rng.below(2) === 0) t.terminals += "?";
    if (rng.below(2) === 0) t.terminals += "!";

    // --- compounding ----------------------------------------------------
    // Some languages join two roots into one word. This is word FORMATION,
    // not punctuation, so a compound is a single token and appears on the
    // `tokens` path like any other word.
    t.compounds = rng.below(4) === 0;

    // vowel digraphs -----------------------------------------------------
    // FIX #2: original inner loop overwrote index rVowD every pass, so only
    // ~5 entries survived (each the last pairing). Now every vowel pair is
    // emitted, giving a real table of VOWELS.length^2 digraphs.
    // Every ordered pair from THIS language's vowel subset. Spec 1.x and 2.x
    // built all 36 pairs from the full canon and then never read the table —
    // a universal table would reintroduce exactly the uniformity the subsets
    // exist to remove. A CVV language draws its vowel clusters from here.
    for (let i = 0; i < t.vowelSet.length; i++) {
      for (let j = 0; j < t.vowelSet.length; j++) {
        if (i === j) continue;   // a doubled vowel is a long vowel, not a cluster
        t.vowelDigraphs.push(t.vowelSet.charAt(i) + t.vowelSet.charAt(j));
      }
    }

    // consonant digraphs -------------------------------------------------
    const nConDigraphs = 30;
    for (let k = 0; k < nConDigraphs; k++) {
      let a = rng.below(t.consSet.length);
      let b = rng.below(t.consSet.length);
      while (a === b) b = rng.below(t.consSet.length);
      t.consonantDigraphs.push(t.consSet.charAt(a) + t.consSet.charAt(b));
    }

    // consonant trigraphs ------------------------------------------------
    const nConTrigraphs = 10;
    for (let k = 0; k < nConTrigraphs; k++) {
      const idx = [
        rng.below(t.consSet.length),
        rng.below(t.consSet.length),
        rng.below(t.consSet.length),
      ];
      // de-duplicate the three positions so no trigraph has a repeat
      for (let a = 0; a < 3; a++) {
        for (let b = 0; b < 3; b++) {
          if (a !== b) {
            while (idx[a] === idx[b]) idx[b] = rng.below(t.consSet.length);
          }
        }
      }
      t.consonantTrigraphs.push(
        t.consSet.charAt(idx[0]) +
        t.consSet.charAt(idx[1]) +
        t.consSet.charAt(idx[2])
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
        const a = rng.below(t.consSet.length + t.vowelSet.length);
        const b = rng.below(t.consSet.length + t.vowelSet.length);
        t.contractions.push("'" + (t.consSet + t.vowelSet).charAt(a) + (t.consSet + t.vowelSet).charAt(b));
      } else {
        const a = rng.below(t.consSet.length + t.vowelSet.length);
        t.contractions.push("'" + (t.consSet + t.vowelSet).charAt(a));
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
      this._lastSource = SRC.PHRASE;
      return this._phraseQueue.shift();
    }
    // 2. short-circuit: all recurrence off -> no draws, vectors intact
    if (this.phrases <= 0 && this.functionWords <= 0 &&
        this.topics <= 0 && this.names <= 0) {
      this._lastSource = SRC.FRESH;
      return null;
    }
    if (this.section === null) this.newSection();

    // 3. independent rolls, fixed order, first hit wins
    if (this.phrases > 0 && this.section.phrases.length &&
        this.rng.next() < this.phrases) {
      const p = this.section.phrases[this.rng.below(this.section.phrases.length)];
      for (let i = 1; i < p.length; i++) this._phraseQueue.push(p[i]);
      this._lastSource = SRC.PHRASE;
      return p[0];
    }
    if (this.functionWords > 0 && this.rng.next() < this.functionWords) {
      const t = this.tables.functionWords;
      this._lastSource = SRC.FUNCTION;
      return t[this.rng.below(t.length)];
    }
    if (this.topics > 0 && this.section.topics.length &&
        this.rng.next() < this.topics) {
      const t = this.section.topics;
      this._lastSource = SRC.TOPIC;
      return t[this.rng.below(t.length)];
    }
    if (this.names > 0 && this.section.names.length &&
        this.rng.next() < this.names) {
      const t = this.section.names;
      this._lastSource = SRC.NAME;
      return t[this.rng.below(t.length)];
    }
    this._lastSource = SRC.FRESH;
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
    // Starts at ONE letter. A single-letter function word is a particle — the
    // equivalent of English `a` or `I` — and languages have them. word()
    // keeps its own floor of one full root, because a single-letter CONTENT
    // word is a truncation artifact rather than a word class. The distinction
    // is deliberate: short grammar, never short vocabulary.
    const particles = 4;
    for (let i = 0; i < particles; i++) {
      t.push(this.word(1, { contractions: false }));
    }
    const RL = this.tables.root.length;
    // Erosion draws from a small space at the short end, so collisions are
    // common. Redraw ONCE against the whole table; if the redraw collides too,
    // keep it. A fixed cap, never a loop: a small inventory would spin. C must
    // redraw at exactly these points or the streams diverge.
    for (let i = 0; i < n - particles; i++) {
      const opts = {
        contractions: false,
        noClusters: this.tables.root === "CVV",
        cut: i
      };
      let w = this.word(RL, opts);
      if (t.indexOf(w) !== -1) w = this.word(RL, opts);
      t.push(w);
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
    const noClusters = opts.noClusters === true;
    const rng = this.rng;
    const t = this.tables;

    let n = numLetters | 0;
    if (n <= 0) n = 1;

    // --- build one root-shaped run --------------------------------------
    // Length is rounded UP to a whole number of roots, minimum one, so a word
    // is an honest instance of the language's shape rather than a truncation
    // of it. This is why single-letter words cannot occur: the shortest
    // possible word is one full root.
    const run = (len) => {
      const R = t.root;
      const reps = Math.max(1, Math.round(len / R.length));
      const slots = R.repeat(reps);
      const bounds = new Array(slots.length + 1).fill(-1);
      let out = "";
      let i = 0;
      while (i < slots.length) {
        bounds[i] = out.length;
        if (slots[i] === "V") {
          // Two adjacent vowel slots take a cluster from this language's own
          // table, mirroring how consonant runs take digraphs and trigraphs.
          let vk = 0;
          while (i + vk < slots.length && slots[i + vk] === "V") vk++;
          if (vk >= 2 && t.vowelDigraphs.length && !noClusters) {
            out += t.vowelDigraphs[rng.below(t.vowelDigraphs.length)];
            i += 2;
            continue;
          }
          let ch = t.vowelSet.charAt(this._wpick(t.vowelW));
          // Redraw once if it would repeat the previous letter. Adjacent
          // slots of the same class collide often in a small inventory, and a
          // doubled letter at a slot boundary reads as a stutter, not a
          // geminate. One redraw, never a loop: a small inventory would spin.
          if (ch === out.slice(-1)) ch = t.vowelSet.charAt(this._wpick(t.vowelW));
          out += ch;
          i++;
          continue;
        }
        // Consonant run. This is where the digraph and trigraph tables
        // belong: they ARE this language's permitted clusters, so they fill
        // adjacent consonant slots rather than being spliced over a finished
        // word. Spec 2.x injected them positionally, which appended clusters
        // to templates that forbid them — a CVCV language has no consonant
        // clusters at all, exactly as Hawaiian has none, and under this rule
        // it correctly never uses a digraph.
        let k = 0;
        while (i + k < slots.length && slots[i + k] === "C") k++;
        if (k >= 3 && t.consonantTrigraphs.length && !noClusters) {
          out += t.consonantTrigraphs[rng.below(t.consonantTrigraphs.length)];
          i += 3;
        } else if (k >= 2 && t.consonantDigraphs.length && !noClusters) {
          out += t.consonantDigraphs[rng.below(t.consonantDigraphs.length)];
          i += 2;
        } else {
          let ch = t.consSet.charAt(this._wpick(t.consW));
          if (ch === out.slice(-1)) ch = t.consSet.charAt(this._wpick(t.consW));
          out += ch;
          i++;
        }
      }
      bounds[slots.length] = out.length;
      this._lastBounds = bounds;
      this._lastSlots = slots;
      return out;
    };

    // A particle: one letter, drawn from this language's own inventory rather
    // than rounded up to a whole root. Only _buildFunctionWords asks for this,
    // and only for grammar words — the equivalent of English `a` or `I`. A
    // one-letter CONTENT word would be a truncation artifact, which is why
    // run() keeps its floor of one full root for everything else.
    if (opts.cut !== undefined) {
      const R = t.root;
      const w0 = run(R.length);
      const b = this._lastBounds;
      const legal = [];
      for (let k = 2; k <= R.length; k++) {
        if (k < R.length) {
          const last = R[k - 1], prev = R[k - 2];
          if (!(last === "V" || (last === "C" && prev === "V"))) continue;
        }
        if (b[k] >= 0) legal.push(b[k]);
      }
      if (!legal.length) return clusterGuard(w0);
      // Skew short: the most-used words wear down most. The pattern indexes
      // the cut list; where a language has fewer cuts than the pattern reaches,
      // the index CLAMPS to the longest available rather than wrapping back to
      // the shortest, so the short-heavy intent survives a two-cut template.
      const pat = [0, 0, 0, 1, 1, 2][opts.cut % 6];
      const at = legal[Math.min(pat, legal.length - 1)];
      return clusterGuard(w0.slice(0, at));
    }

    if (n === 1) {
      const useVowel = rng.below(3) === 0;
      return useVowel
        ? t.vowelSet.charAt(this._wpick(t.vowelW))
        : t.consSet.charAt(this._wpick(t.consW));
    }

    let word;
    if (t.compounds && n >= 6 && rng.below(3) === 0) {
      // A compound is ONE token — count-exact callers stay exact.
      word = run(Math.ceil(n / 2)) + "-" + run(Math.floor(n / 2));
    } else {
      word = run(n);
    }

    // --- digraph / trigraph injection ------------------------------------
    // The substrate tables are built from this language's own inventory, so a
    // splice can never introduce a letter the language does not use.
    if (useContractions && rng.below(4) === 0) {
      word += this._randomContraction();
    }

    return clusterGuard(word);
  }

  // Weighted index pick against a cumulative table from mkw().
  _wpick(cum) {
    const x = this.rng.next();
    for (let i = 0; i < cum.length; i++) if (x < cum[i]) return i;
    return cum.length - 1;
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
      if (this.tables.capitalizeQuoted && words[start]) {
        words[start] = words[start].charAt(0).toUpperCase() + words[start].slice(1);
      }
      words[start] = this.tables.quotePair[0] + words[start];
      words[end] = words[end] + this.tables.quotePair[1];
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
        words[i] = this.tables.quotePair[0] + words[i] + this.tables.quotePair[1];
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
          words[i] = words[i] + this.tables.clauseMark;
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
    const p = this.tables.terminals.charAt(this.rng.below(this.tables.terminals.length));
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
      const words = this.sentence(this.rng.below(maxWords), maxLetters);
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
    return this.tokensWithSource(n, maxLetters).map((t) => t.text);
  }

  // Same generation as tokens(), but each entry carries its source
  // classification: { text, source } where source is one of SRC.*. This is the
  // JS mirror of the C kernel's `ortho_token` struct, and the form the v2
  // golden vectors record. Identical draw order to tokens() — the source is
  // observed, never rolled for — so adding it changed no output.
  tokensWithSource(n, maxLetters = 8) {
    let count = n | 0;
    if (count < 0) count = 0;
    const out = new Array(count);
    for (let i = 0; i < count; i++) {
      // same weave as sentence(): lets the harness stress "every token
      // unique" (all dials 0) vs "same few terms hammered" (high) — two very
      // different intake pressures. Zero PRNG cost when all recurrence dials
      // are 0, so the frozen golden vectors remain byte-valid.
      let w = this._recurrentOrNull();
      let src = this._lastSource;
      if (w === null) {
        const len = 1 + this.rng.below(maxLetters); // 1..maxLetters, never 0
        w = this.word(len);
        src = SRC.FRESH;
      }
      out[i] = { text: w, source: src };
    }
    return out;
  }
}

/* SPEC 2.0 §5.1 step 8 — cluster guard.
 *
 * A filter over the finished word, not a decision: consumes no PRNG draws, so
 * it cannot shift the stream. Drops a character when either holds:
 *   - it would be the third consecutive occurrence of the same letter
 *   - it is a consonant identical to the one before it, with at least two
 *     consonants already in the run
 *
 * Trigraphs (three DISTINCT consonants) are deliberately untouched — they are
 * how a seed's own tables reach the page. Apostrophes are transparent: neither
 * vowel nor consonant, and they do not reset the run.
 */
function clusterGuard(w) {
  if (!w) return w;
  const V = "aeiouy";
  const isC = (c) => c !== "'" && V.indexOf(c) === -1;
  let out = "";
  let cons = 0;
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    if (out.length >= 2 && ch === out[out.length - 1] && ch === out[out.length - 2]) continue;
    if (isC(ch)) {
      if (cons >= 2 && out.length && ch === out[out.length - 1]) continue;
      cons++;
    } else if (ch !== "'") {
      cons = 0;
    }
    out += ch;
  }
  return out;
}


export { Ortho, ALPHABET, CONSONANTS, VOWELS, PUNCTUATION, SRC };
