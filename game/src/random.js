// Seeded random number generator (mulberry32) so the city and every screenshot
// scene are reproducible from one seed. Same seed, same Virelia — every time.
export function createRandom(seed) {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) { return min + this.next() * (max - min); },
    int(min, max) { return Math.floor(this.range(min, max + 1)); },
    pick(list) { return list[Math.floor(this.next() * list.length)]; },
    // A random element that passes a predicate, up to `tries` draws — null
    // when nothing qualifies, so callers can fall back cleanly.
    pickWhere(list, pred, tries = 10) {
      for (let i = 0; i < tries; i += 1) {
        const item = this.pick(list);
        if (pred(item)) return item;
      }
      return null;
    },
    // n distinct entries, no repeats — a shuffled prefix of a copy.
    sample(list, n) {
      const copy = list.slice();
      this.shuffle(copy);
      return copy.slice(0, Math.max(0, Math.min(n, copy.length)));
    },
    bool(prob) { return this.next() < prob; },
    shuffle(list) {
      for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.next() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    },
    // A random compass angle, handy for spawning patrol cars around the player.
    angle() { return this.next() * Math.PI * 2; },
    // Roughly bell-shaped pick in [min, max] (average of two uniforms).
    bell(min, max) { return (this.next() + this.next()) / 2 * (max - min) + min; },
  };
}

// Cheap deterministic hash for stable per-object flicker (neon signs, waves):
// same id + same time bucket, same value — no per-frame random stream use.
export function hash01(id, bucket) {
  let h = (id * 2654435761 + bucket * 40503) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
