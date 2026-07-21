// play.js
//
// Developer smoke test for the Ortho language engine.
// Run with:
//
//     cd ~/Documents/ortho
//     node play.js
//
// (The package is ES modules now — this file uses `import`. It runs directly
// under Node because package.json has "type": "module".)

import { Ortho, render } from "./src/index.js";

const seed = 12345;

function heading(title) {
  console.log("\n");
  console.log("==================================================");
  console.log(title);
  console.log("==================================================");
}

// A pleasant "everything on" character, via the preset onramp. Used by the
// sections that just want readable text without hand-tuning seven dials.
const RICH = { preset: 0.45 };

//
// --------------------------------------------------
// BASIC LANGUAGE
// --------------------------------------------------
//
heading("BASIC LANGUAGE (bare — all dials 0)");
const ortho = new Ortho(seed);
console.log("\nWORD");
console.log(ortho.word(6));
console.log("\nSENTENCE");
console.log(ortho.sentence(8, 8).join(" "));
console.log("\nPARAGRAPH");
console.log(render(ortho.paragraph(4, 8, 8)));
console.log("\nPAGE (render() adds blank-line breaks)");
console.log(render(ortho.page(3)));
console.log("\nTOKENS");
console.log(ortho.tokens(20).join(" "));

//
// --------------------------------------------------
// RECURRENCE FAMILY — each dial in isolation
// --------------------------------------------------
//
// The old single `repetition` knob is now four independent dials. Showing them
// one at a time makes it obvious what each contributes.
//
heading("RECURRENCE DIALS (one at a time)");
[
  ["names", { names: 0.6 }],
  ["topics", { topics: 0.6 }],
  ["functionWords", { functionWords: 0.6 }],
  ["phrases", { phrases: 0.6 }],
].forEach(([label, dials]) => {
  console.log(`\n${label} = ${Object.values(dials)[0]}\n`);
  console.log(render(new Ortho(seed, dials).paragraph(6, 8, 8)));
});

console.log("\nall four together (preset-style)\n");
console.log(render(new Ortho(seed, {
  phrases: 0.4, functionWords: 0.6, topics: 0.5, names: 0.5,
}).paragraph(6, 8, 8)));

//
// --------------------------------------------------
// PUNCTUATION FAMILY — each dial in isolation
// --------------------------------------------------
//
heading("PUNCTUATION DIALS (one at a time)");
// recurrence kept low-but-on so quotation has a name cast to anchor to
const base = { names: 0.4, topics: 0.3 };
[
  ["commas", { ...base, commas: 0.8 }],
  ["quotation", { ...base, quotation: 0.9 }],
  ["scareQuotes", { ...base, scareQuotes: 0.7 }],
].forEach(([label, dials]) => {
  console.log(`\n${label} on\n`);
  console.log(render(new Ortho(seed, dials).paragraph(6, 9, 8)));
});

//
// --------------------------------------------------
// PRESET MACRO — the one-knob onramp
// --------------------------------------------------
//
heading("PRESET SWEEP");
[0.0, 0.25, 0.5, 0.9].forEach(level => {
  console.log(`\npreset = ${level}\n`);
  console.log(render(new Ortho(seed, { preset: level }).paragraph(6, 8, 8)));
});

console.log("\noverride: preset 0.5 but commas forced off\n");
console.log(render(new Ortho(seed, { preset: 0.5, commas: 0 }).paragraph(6, 8, 8)));

//
// --------------------------------------------------
// SECTION CHANGES
// --------------------------------------------------
//
heading("SECTION TRANSITION");
const story = new Ortho(seed, RICH);
console.log("\nSECTION ONE\n");
console.log(render(story.page(2)));
story.newSection();
console.log("\n\nSECTION TWO (after newSection() — new cast)\n");
console.log(render(story.page(2)));

//
// --------------------------------------------------
// DETERMINISM
// --------------------------------------------------
//
heading("DETERMINISM");
const a = new Ortho(seed, RICH);
const b = new Ortho(seed, RICH);
console.log(render(a.page(3)) === render(b.page(3))
  ? "PASS — identical output"
  : "FAIL — output differs");

//
// --------------------------------------------------
// DIFFERENT SEEDS
// --------------------------------------------------
//
heading("DIFFERENT SEEDS (each a different language)");
[1, 42, 12345, 99999].forEach(s => {
  console.log(`\nSeed ${s}\n`);
  console.log(render(new Ortho(s, RICH).paragraph(3, 8, 8)));
});

//
// --------------------------------------------------
// HARNESS INVARIANTS
// --------------------------------------------------
//
// The count-exact / bare-tokens guarantees the C port and ScriptHub rely on.
//
heading("HARNESS INVARIANTS");
const inv = [];
inv.push(["tokens count-exact",
  [0, 1, 7, 1000].every(n => new Ortho(9, { preset: 0.9 }).tokens(n).length === n)]);
inv.push(["tokens stay bare (no quotes/commas even at max punctuation)",
  !/[",]/.test(new Ortho(5, { commas: 1, quotation: 1, scareQuotes: 1 }).tokens(80).join(" "))]);
inv.push(["all-zero adds no punctuation",
  !/[",]/.test(new Ortho(7).paragraph(6, 8, 8).join(" "))]);
inv.forEach(([label, ok]) => console.log(`${ok ? "PASS" : "FAIL"} — ${label}`));

//
// --------------------------------------------------
// LARGE TOKEN TEST
// --------------------------------------------------
//
heading("TOKEN STRESS TEST");
const stress = new Ortho(seed);
const tokens = stress.tokens(10000);
console.log(`Generated ${tokens.length} tokens.`);
console.log("\nFirst 40:");
console.log(tokens.slice(0, 40).join(" "));
console.log("\nLast 40:");
console.log(tokens.slice(-40).join(" "));
