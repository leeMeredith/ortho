// test/conformance.js — proves this implementation matches the golden vectors.
//
//     node test/conformance.js
//
// This is the test every conforming host mirrors (ortho-kernel, ortho-max,
// ortho-of). A clean pass is the definition of "coherent with the reference."
// See SPEC.md §8 and §10.
//
// Vectors v2 carry three columns: <index>\t<word>\t<source>. The source column
// classifies each token's origin (0 fresh, 1 functionWord, 2 topic, 3 name,
// 4 phrase) so ports must reproduce not just the text but WHY each token
// appeared. Bare vectors (all dials 0) prove the baseline; preset vectors
// exercise all five source classes.

import { readFileSync } from "node:fs";
import { Ortho, SRC } from "../src/index.js";

const VERSION = "v2";

// [seed, n, maxLetters, preset, filename]
const CASES = [
  [0, 50, 8, 0, "seed_0_bare.txt"],
  [1, 50, 8, 0, "seed_1_bare.txt"],
  [42, 50, 8, 0, "seed_42_bare.txt"],
  [12345, 50, 8, 0, "seed_12345_bare.txt"],
  [4294967295, 50, 8, 0, "seed_4294967295_bare.txt"],
  [42, 80, 8, 0.5, "seed_42_preset50.txt"],
  [12345, 80, 8, 0.5, "seed_12345_preset50.txt"],
];

let failures = 0;

for (const [seed, n, maxLetters, preset, file] of CASES) {
  const path = new URL(`./vectors/${VERSION}/${file}`, import.meta.url);
  const expected = readFileSync(path, "utf8").trimEnd();

  const o = new Ortho(seed, preset > 0 ? { preset } : {});
  const toks = o.tokensWithSource(n, maxLetters);
  const actual = toks.map((t, i) => `${i}\t${t.text}\t${t.source}`).join("\n");

  const label = `seed ${seed}${preset > 0 ? ` preset ${preset}` : " bare"}`;
  if (actual === expected) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.log(`FAIL  ${label}`);
    const a = actual.split("\n");
    const e = expected.split("\n");
    for (let i = 0; i < Math.max(a.length, e.length); i++) {
      if (a[i] !== e[i]) {
        console.log(`      line ${i}: expected ${JSON.stringify(e[i])}, got ${JSON.stringify(a[i])}`);
        break;
      }
    }
  }
}

// invariants from SPEC.md §10
const inv = [
  ["count-exact",
    [0, 1, 7, 1000].every((n) => new Ortho(9, { preset: 0.9 }).tokens(n).length === n)],
  ["bare tokens (no quotes/commas at max punctuation)",
    !/["#,]/.test(new Ortho(5, { commas: 1, quotation: 1, scareQuotes: 1 }).tokens(80).join(" "))],
  ["deterministic",
    new Ortho(3, { preset: 0.5 }).tokens(100).join(" ") ===
    new Ortho(3, { preset: 0.5 }).tokens(100).join(" ")],
  ["all-zero dials give all-FRESH sources",
    new Ortho(11).tokensWithSource(60).every((t) => t.source === SRC.FRESH)],
  ["source travels with text (tokens() matches tokensWithSource())",
    new Ortho(4, { preset: 0.6 }).tokens(50).join("|") ===
    new Ortho(4, { preset: 0.6 }).tokensWithSource(50).map((t) => t.text).join("|")],
  ["every token fits ORTHO_MAX_TOKEN (48)",
    new Ortho(8, { preset: 0.8 }).tokens(2000).every((w) => w.length < 48)],
];
for (const [label, ok] of inv) {
  console.log(`${ok ? "PASS" : "FAIL"}  invariant: ${label}`);
  if (!ok) failures++;
}

console.log(failures === 0
  ? `\nCONFORMANT — spec 1.1, vectors ${VERSION}`
  : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
