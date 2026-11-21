// The Ducci map and the facts about it that the census checks.
//
//   D(a1, …, an) = (|a1 − a2|, |a2 − a3|, …, |an − a1|)
//
// Integer tuples: D never raises the largest entry, so every orbit ends in a cycle.
// Binary tuples (entries 0/1): |x − y| = x XOR y, so D is the linear map I + S over GF(2)
// (S = cyclic shift) — on an n-bit word, x ↦ x XOR rotate(x, 1). That is elementary
// cellular automaton rule 102 on a ring of n cells.

export type Tuple = number[];

export function step(a: readonly number[]): number[] {
  const n = a.length;
  const b = new Array<number>(n);
  for (let i = 0; i < n; i++) b[i] = Math.abs(a[i] - a[(i + 1) % n]);
  return b;
}

export const isZero = (a: readonly number[]) => a.every((x) => x === 0);
export const isConstant = (a: readonly number[]) => a.every((x) => x === a[0]);
export const key = (a: readonly number[]) => a.join(',');

export interface Orbit {
  /** a, D(a), D²(a), … up to and including the first repeat. */
  path: number[][];
  /** moves before the cycle (μ) */
  preperiod: number;
  /** cycle length (λ) */
  period: number;
}

/** Follow D from a until a tuple repeats. */
export function orbit(a: readonly number[], limit = 1_000_000): Orbit {
  const seen = new Map<string, number>();
  const path: number[][] = [];
  let x = a.slice();
  for (let i = 0; i <= limit; i++) {
    const k = key(x);
    const j = seen.get(k);
    if (j !== undefined) {
      path.push(x);
      return { path, preperiod: j, period: i - j };
    }
    seen.set(k, i);
    path.push(x);
    x = step(x);
  }
  throw new Error('orbit limit exceeded');
}

/** Brent's cycle detection without storing the orbit: [preperiod μ, period λ, a tuple on the cycle]. */
export function brent(a: readonly number[]): [number, number, number[]] {
  let power = 1, lam = 1;
  let tortoise = a.slice();
  let hare = step(a);
  while (key(tortoise) !== key(hare)) {
    if (power === lam) { tortoise = hare; power *= 2; lam = 0; }
    hare = step(hare);
    lam++;
  }
  let t = a.slice(), h = a.slice();
  for (let i = 0; i < lam; i++) h = step(h);
  let mu = 0;
  while (key(t) !== key(h)) { t = step(t); h = step(h); mu++; }
  return [mu, lam, t];
}

/** Number of moves until the all-zero tuple ("Diffy length"), or −1 if the orbit never gets there. */
export function lengthToZero(a: readonly number[]): number {
  const o = orbit(a);
  const last = o.path[o.preperiod];
  return isZero(last) ? o.preperiod : -1;
}

/** Fast Diffy length of a quadruple (never allocates). Every integer quadruple reaches 0. */
export function diffy4(a: number, b: number, c: number, d: number): number {
  let n = 0;
  while (a !== 0 || b !== 0 || c !== 0 || d !== 0) {
    const a1 = a > b ? a - b : b - a;
    const b1 = b > c ? b - c : c - b;
    const c1 = c > d ? c - d : d - c;
    const d1 = d > a ? d - a : a - d;
    a = a1; b = b1; c = c1; d = d1;
    n++;
  }
  return n;
}

/** Is every entry 0 or one common value c? (Burmester–Forcade–Jacobs: the cycles look like this.) */
export function isScaledBinary(a: readonly number[]): boolean {
  let c = 0;
  for (const x of a) {
    if (x === 0) continue;
    if (c === 0) c = x;
    else if (x !== c) return false;
  }
  return true;
}

// ---------------------------------------------------------------- binary (GF(2)) Ducci on n-bit words

/** x ↦ x XOR rot(x): bit i of the result is bit i XOR bit i+1 (cyclically), n ≤ 31. */
export function binStep(x: number, n: number): number {
  const mask = n === 32 ? 0xffffffff : (1 << n) - 1;
  const rot = ((x >>> 1) | ((x & 1) << (n - 1))) & mask;
  return (x ^ rot) >>> 0;
}

export function toBits(x: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push((x >>> i) & 1);
  return out;
}

export function fromBits(a: readonly number[]): number {
  let x = 0;
  for (let i = 0; i < a.length; i++) if (a[i]) x |= 1 << i;
  return x >>> 0;
}

export const twoAdic = (n: number) => n & -n; // A006519: largest power of 2 dividing n

/**
 * Periodic points of the binary map for n = 2^k·m (m odd): x lies on a cycle iff each of the
 * 2^k residue classes of positions mod 2^k has even weight (the image of (1 + S)^{2^k} = 1 + S^{2^k}).
 * The census checks this against the walk instead of assuming it.
 */
export function isPeriodicBinary(x: number, n: number): boolean {
  const p = twoAdic(n);
  for (let r = 0; r < p; r++) {
    let w = 0;
    for (let i = r; i < n; i += p) w ^= (x >>> i) & 1;
    if (w) return false;
  }
  return true;
}

// ---------------------------------------------------------------- GF(2) linear algebra (cross-check)

/** n×n bit matrix as an array of row masks (n ≤ 31). */
export type BitMatrix = number[];

export function ducciMatrix(n: number): BitMatrix {
  const rows: number[] = [];
  for (let i = 0; i < n; i++) rows.push(((1 << i) ^ (1 << ((i + 1) % n))) >>> 0);
  return rows;
}

export function matMul(A: BitMatrix, B: BitMatrix): BitMatrix {
  // (AB)_i = XOR over j in row i of A of row j of B
  return A.map((row) => {
    let r = 0;
    for (let j = 0; j < 32 && row >>> j; j++) if ((row >>> j) & 1) r ^= B[j];
    return r >>> 0;
  });
}

export function matPow(A: BitMatrix, e: number): BitMatrix {
  const n = A.length;
  let R: BitMatrix = Array.from({ length: n }, (_, i) => (1 << i) >>> 0);
  let B = A.slice();
  while (e > 0) {
    if (e & 1) R = matMul(R, B);
    B = matMul(B, B);
    e = Math.floor(e / 2);
  }
  return R;
}

export function rank2(A: BitMatrix): number {
  const rows = A.slice();
  let r = 0;
  for (let bit = 0; bit < 32 && r < rows.length; bit++) {
    let p = -1;
    for (let i = r; i < rows.length; i++) if ((rows[i] >>> bit) & 1) { p = i; break; }
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    for (let i = 0; i < rows.length; i++) if (i !== r && (rows[i] >>> bit) & 1) rows[i] ^= rows[r];
    r++;
  }
  return r;
}

/** Number of binary words with D^d(x) = x, i.e. 2^dim ker(L^d + I). */
export function fixedCount(n: number, d: number): number {
  const L = matPow(ducciMatrix(n), d);
  const M = L.map((row, i) => (row ^ (1 << i)) >>> 0);
  return 2 ** (n - rank2(M));
}

export function divisors(m: number): number[] {
  const out: number[] = [];
  for (let d = 1; d * d <= m; d++) if (m % d === 0) { out.push(d); if (d * d !== m) out.push(m / d); }
  return out.sort((x, y) => x - y);
}

function mobius(m: number): number {
  let r = 1;
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) { m /= p; if (m % p === 0) return 0; r = -r; }
  }
  return m > 1 ? -r : r;
}

/**
 * Cycles of the binary map counted by algebra instead of walking: words of exact period d number
 * g(d) = Σ_{e | d} μ(d/e)·fix(e), and the cycles are Σ g(d)/d over the divisors d of the largest period P.
 * Returns {cycles, lengths} — the distinct cycle lengths.
 */
export function cyclesByAlgebra(n: number, P: number): { cycles: number; lengths: number[] } {
  const ds = divisors(P);
  const fix = new Map(ds.map((d) => [d, fixedCount(n, d)]));
  let cycles = 0;
  const lengths: number[] = [];
  for (const d of ds) {
    let g = 0;
    for (const e of divisors(d)) g += mobius(d / e) * fix.get(e)!;
    if (g > 0) { cycles += g / d; lengths.push(d); }
  }
  return { cycles, lengths };
}

// ---------------------------------------------------------------- the four-number game

/** Tribonacci numbers t0 = 0, t1 = 0, t2 = 1, t(k) = t(k−1) + t(k−2) + t(k−3) (OEIS A000073). */
export function tribonacci(count: number): number[] {
  const t = [0, 0, 1];
  while (t.length < count) t.push(t[t.length - 1] + t[t.length - 2] + t[t.length - 3]);
  return t.slice(0, count);
}

/** The real quadruple (1, q, q², q³) for the tribonacci constant q never reaches zero (it shrinks forever). */
export const TRIBONACCI_CONSTANT = 1.839286755214161;

// ---------------------------------------------------------------- normal forms

/** Canonical form under rotation, reflection and adding a constant (all three commute with D). */
export function canonical(a: readonly number[]): number[] {
  const n = a.length;
  const m = Math.min(...a);
  const b = a.map((x) => x - m);
  let best: number[] | null = null;
  for (const seq of [b, b.slice().reverse()]) {
    for (let r = 0; r < n; r++) {
      const c = seq.slice(r).concat(seq.slice(0, r));
      if (best === null || lexLess(c, best)) best = c;
    }
  }
  return best!;
}

function lexLess(x: number[], y: number[]): boolean {
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i];
  return false;
}

export function parseTuple(s: string): number[] | null {
  const parts = s.split(/[\s,;]+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 64) return null;
  const v = parts.map(Number);
  if (v.some((x) => !Number.isInteger(x) || x < 0 || x > 1e12)) return null;
  return v;
}
