// Seeded random number generator (mulberry32) so the city and every screenshot
// scene are reproducible from one seed. Same seed, same Virelia — every time.
// The generator is a closure over one 32-bit state: next() advances it and
// returns a float in [0, 1); everything else (range, int, pick, sample, bool,
// shuffle, angle, bell, pickWhere) is built on top of that one stream, so the
// order of calls is the only thing that decides what comes out.
// Gameplay must never use Math.random — the seeded stream is what keeps
// screenshots, tests and replays deterministic.
export function createRandom(seed) {
  let a = seed >>> 0;
  const rng = {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + rng.next() * (max - min);
    },
    int(min, max) {
      return Math.floor(rng.range(min, max + 1));
    },
    pick(list) {
      return list[Math.floor(rng.next() * list.length)];
    },
    // n distinct entries, no repeats — a shuffled prefix of a copy.
    sample(list, n) {
      const copy = list.slice();
      rng.shuffle(copy);
      return copy.slice(0, Math.max(0, Math.min(n, copy.length)));
    },
    bool(prob) {
      return rng.next() < prob;
    },
    shuffle(list) {
      for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng.next() * (i + 1));
        const tmp = list[i];
        list[i] = list[j];
        list[j] = tmp;
      }
      return list;
    },
    // A random compass angle, handy for spawning patrol cars around the player.
    angle() {
      return rng.next() * Math.PI * 2;
    },
    // Roughly bell-shaped pick in [min, max] (average of two uniforms).
    bell(min, max) {
      return ((rng.next() + rng.next()) / 2) * (max - min) + min;
    },
    // First list entry that passes pred, within `tries` draws — null when
    // nothing qualifies. Used for picking a fare destination in range.
    pickWhere(list, pred, tries = 10) {
      for (let i = 0; i < tries; i += 1) {
        const item = list[Math.floor(rng.next() * list.length)];
        if (item !== undefined && pred(item)) return item;
      }
      return null;
    },
  };
  return rng;
}

// Cheap deterministic hash for stable per-object flicker (neon signs, waves):
// same id + same time bucket, same value — no per-frame random stream use.
export function hash01(id, bucket) {
  let h = (id * 2654435761 + bucket * 40503) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
