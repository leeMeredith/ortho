// test/conformance.js — proves this implementation matches the golden vectors.
//
//     node test/conformance.js
//
// This is the test every conforming host mirrors (ortho-kernel, ortho-max,
// ortho-of). A clean pass is the definition of "coherent with the reference."
// See SPEC.md §8 and §10.

import { readFileSync } from "node:fs";
import { Ortho } from "../src/index.js";

const SEEDS = [0, 1, 42, 12345, 4294967295];
const N = 50;
const VERSION = "v1";

let failures = 0;

for (const seed of SEEDS) {
  const path = new URL(`./vectors/${VERSION}/seed_${seed}.txt`, import.meta.url);
  const expected = readFileSync(path, "utf8").trimEnd();

  // all seven dials at 0 — the baseline the vectors were frozen at
  const toks = new Ortho(seed).tokens(N);
  const actual = toks.map((w, i) => `${i}\t${w}`).join("\n");

  if (actual === expected) {
    console.log(`PASS  seed ${seed}`);
  } else {
    failures++;
    console.log(`FAIL  seed ${seed}`);
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
  ["count-exact", [0, 1, 7, 1000].every(n => new Ortho(9, { preset: 0.9 }).tokens(n).length === n)],
  ["bare tokens", !/["#,]/.test(new Ortho(5, { commas: 1, quotation: 1, scareQuotes: 1 }).tokens(80).join(" "))],
  ["deterministic", new Ortho(3, { preset: 0.5 }).tokens(100).join(" ") ===
                    new Ortho(3, { preset: 0.5 }).tokens(100).join(" ")],
];
for (const [label, ok] of inv) {
  console.log(`${ok ? "PASS" : "FAIL"}  invariant: ${label}`);
  if (!ok) failures++;
}

console.log(failures === 0
  ? `\nCONFORMANT — spec 1.0, vectors ${VERSION}`
  : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
