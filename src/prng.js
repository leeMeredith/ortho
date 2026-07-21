// prng.js — Mulberry32
// A tiny, fast, seedable 32-bit PRNG. This exact algorithm is mirrored in the
// C engine (prng.c/h) so that the same seed yields the same language in both.
//
// PORTING NOTE: in C, `state` is a uint32_t and all math is done in uint32_t /
// uint64_t as marked. JS uses `>>> 0` and Math.imul to emulate uint32 overflow;
// C gets it natively. Keep the two implementations in lockstep.

class Mulberry32 {
  constructor(seed) {
    // seed is a uint32. seed 0 is allowed and deterministic.
    this.state = seed >>> 0;
  }

  // Returns a uint32 in [0, 2^32).
  nextU32() {
    // C: state += 0x6D2B79F5u;
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    // C: t = (t ^ (t >> 15)) * (t | 1u);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    // C: t ^= t + (t ^ (t >> 7)) * (t | 61u);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    // C: return (t ^ (t >> 14));
    return (t ^ (t >>> 14)) >>> 0;
  }

  // Float in [0, 1). Matches C: nextU32() / 4294967296.0
  next() {
    return this.nextU32() / 4294967296;
  }

  // Integer in [0, n). Matches C helper prng_below(rng, n).
  below(n) {
    return Math.floor(this.next() * n);
  }
}

export { Mulberry32 };
