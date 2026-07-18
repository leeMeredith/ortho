// demo/cli.js — standalone runner so the repo does something on clone.
//
// Usage:
//   node demo/cli.js                         one paragraph, bare language
//   node demo/cli.js --seed 12345            reproducible language
//   node demo/cli.js --page 3                three paragraphs (blank-line sep)
//   node demo/cli.js --tokens 20             20 neutral word-atoms (harness)
//
// Character dials (0..1), any combination:
//   --phrases --functionWords --topics --names        (recurrence family)
//   --commas --quotation --scareQuotes                (punctuation family)
//   --preset 0.4                              one-knob onramp over all seven
//
// This is the ONLY file in src/ + demo/ allowed to touch stdout. The engine
// stays I/O-free.

import { Ortho, render } from "../src/index.js";

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i === -1 ? def : process.argv[i + 1];
}
function farg(name) {
  const v = arg("--" + name, undefined);
  return v === undefined ? undefined : parseFloat(v);
}

const seed = parseInt(arg("--seed", "0"), 10) >>> 0;
const opts = { seed };
for (const k of ["preset", "phrases", "functionWords", "topics", "names",
                 "commas", "quotation", "scareQuotes"]) {
  const v = farg(k);
  if (v !== undefined) opts[k] = v;
}
const o = new Ortho(seed, opts);

if (process.argv.includes("--tokens")) {
  const n = parseInt(arg("--tokens", "20"), 10);
  // harness path: bare, space-joined, no line breaks
  process.stdout.write(o.tokens(n).join(" ") + "\n");
} else if (process.argv.includes("--page")) {
  const n = parseInt(arg("--page", "3"), 10);
  // readable path: render() honors paragraph breaks (blank line)
  process.stdout.write(render(o.page(n)) + "\n");
} else {
  process.stdout.write(render(o.paragraph(3, 8, 8)) + "\n");
}