// test/oracle.js — the reference oracle for the JS-vs-C harness.
//
// Dumps tokens(n) output for a given seed, one atom per line, prefixed by
// index. Diff-friendly and count-exact — this is the path the C external
// (ortho_engine.c) must reproduce byte-for-byte from the same seed.
//
// Usage:
//   node test/oracle.js <seed> <n>        e.g. node test/oracle.js 12345 100
//
// The C side runs the equivalent (same seed, same n, same maxLetters) and
// prints in the same "<index>\t<word>" format. `diff` the two outputs; any
// divergence is a bug in the port.
//
// tokens() is chosen (not paragraph/page) because it is the deterministic,
// structure-free path: no punctuation or capitalization decisions to keep in
// sync, just the raw word-generation core. Nail this and the readable APIs,
// which sit on top of the same word()/PRNG, follow.

import { Ortho } from "../src/index.js";

const seed = parseInt(process.argv[2] || "0", 10) >>> 0;
const n = parseInt(process.argv[3] || "100", 10);
const maxLetters = parseInt(process.argv[4] || "8", 10);

const o = new Ortho(seed);
const toks = o.tokens(n, maxLetters);

const lines = [];
for (let i = 0; i < toks.length; i++) {
  lines.push(i + "\t" + toks[i]);
}
process.stdout.write(lines.join("\n") + (toks.length ? "\n" : ""));