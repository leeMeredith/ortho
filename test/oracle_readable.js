// test/oracle_readable.js — readable-path oracle.
//
// The main oracle dumps tokensWithSource(): count-exact, structure-free, no
// punctuation to keep in sync. That is the right primary contract, but it
// leaves the readable path unverified — and that gap has now hidden two bugs
// that passed 7/7 vectors. This dumps paragraph() output so the readable path
// can be diffed across hosts too.
//
// Usage:
//   node test/oracle_readable.js <seed> <numSentences> <maxWords> <maxLetters> [preset]

import { Ortho } from "../src/index.js";

const seed = parseInt(process.argv[2] || "0", 10) >>> 0;
const nsent = parseInt(process.argv[3] || "2", 10);
const maxWords = parseInt(process.argv[4] || "10", 10);
const maxLetters = parseInt(process.argv[5] || "8", 10);
const preset = parseFloat(process.argv[6] || "0");

const o = new Ortho(seed, preset > 0 ? { preset } : {});
const words = o.paragraph(nsent, maxWords, maxLetters);
console.log(words.map((w, i) => i + "\t" + w).join("\n"));
