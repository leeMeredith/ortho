// test/oracle.js — the reference oracle for the cross-host harness.
//
// Dumps tokensWithSource() output for a given seed, one atom per line, as
//     <index>\t<word>\t<source>
// Diff-friendly and count-exact — this is the path every port (C kernel, Max,
// openFrameworks) must reproduce byte-for-byte from the same seed and dials.
//
// Usage:
//   node test/oracle.js <seed> <n> [maxLetters] [preset]
//
// The `source` column is the token's origin classification (see SPEC §6):
//   0 fresh   1 functionWord   2 topic   3 name   4 phrase
// It is observed, never rolled for, so recording it changes no output.
//
// tokensWithSource() is chosen (not paragraph/page) because it is the
// deterministic, structure-free path: no punctuation or capitalization
// decisions to keep in sync, just the raw word-generation core plus origin.

import { Ortho } from "../src/index.js";

const seed = parseInt(process.argv[2] || "0", 10) >>> 0;
const n = parseInt(process.argv[3] || "100", 10);
const maxLetters = parseInt(process.argv[4] || "8", 10);
const preset = parseFloat(process.argv[5] || "0");

const o = new Ortho(seed, preset > 0 ? { preset } : {});
const toks = o.tokensWithSource(n, maxLetters);

const lines = [];
for (let i = 0; i < toks.length; i++) {
  lines.push(i + "\t" + toks[i].text + "\t" + toks[i].source);
}
process.stdout.write(lines.join("\n") + (toks.length ? "\n" : ""));
