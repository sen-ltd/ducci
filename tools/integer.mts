// Integer census.
//
// Part A — the four-number game: every quadruple with entries in [0, M] up to rotation, reflection
// and adding a constant, i.e. (0, b, c, d) with b ≤ d, has its Diffy length (moves to 0000) computed.
// That gives the longest game for every bound m ≤ M (OEIS A065677) and its inverse (A065678, A045794).
//
// Part B — n = 3, 5, 6, 7, 8, 9: every n-tuple with entries in [0, M_n] and a 0 in front (every class
// under rotation + translation appears), followed with Brent's cycle detection. Checks that every cycle
// is c·(0/1 word) (Burmester–Forcade–Jacobs 1978), that its length is the binary cycle length of that
// word, that n = 8 always dies (Ciamberlini–Marengoni 1937), and records the longest preperiod per bound.
//
//   node tools/integer.mts [M4=1000]   → runs/integer.json

import { writeFileSync, mkdirSync } from 'node:fs';
import { binStep } from '../src/ducci.ts';

const M4 = Number(process.argv[2] ?? 1000);
mkdirSync('runs', { recursive: true });
const t0 = Date.now();

// ---------------------------------------------------------------- Part A
const recLen = new Int32Array(M4 + 1).fill(-1);
const recEx: number[][] = Array.from({ length: M4 + 1 }, () => []);
const recCount = new Float64Array(M4 + 1); // (0,b,c,d), b ≤ d, attaining recLen[m] with max exactly m
let tuplesA = 0;
for (let d = 0; d <= M4; d++) {
  for (let b = 0; b <= d; b++) {
    for (let c = 0; c <= M4; c++) {
      const m = c > d ? c : d;
      let A = 0, B = b, C = c, D = d, len = 0;
      while (A !== 0 || B !== 0 || C !== 0 || D !== 0) {
        const a1 = A > B ? A - B : B - A;
        const b1 = B > C ? B - C : C - B;
        const c1 = C > D ? C - D : D - C;
        const d1 = D > A ? D - A : A - D;
        A = a1; B = b1; C = c1; D = d1;
        len++;
      }
      if (len > recLen[m]) { recLen[m] = len; recEx[m] = [0, b, c, d]; recCount[m] = 1; }
      else if (len === recLen[m]) recCount[m]++;
    }
    tuplesA += M4 + 1;
  }
  if (d % 100 === 0) console.log(`A: d=${d} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
// longest game with every entry ≤ m, and the bound where each length first appears
const a065677: number[] = [];
const best: { len: number; tuple: number[]; m: number }[] = [];
let run = -1;
for (let m = 0; m <= M4; m++) {
  if (recLen[m] > run) { run = recLen[m]; best.push({ len: run, tuple: recEx[m], m }); }
  a065677.push(run);
}
const msA = Date.now() - t0;
console.log(`Part A done: ${tuplesA} quadruples, ${msA} ms, longest = ${run}`);

// ---------------------------------------------------------------- Part B
const plan: [number, number][] = [[3, 3000], [5, 55], [6, 24], [7, 14], [8, 9], [9, 7]];
const partB: unknown[] = [];

for (const [n, M] of plan) {
  const ts = Date.now();
  const a = new Float64Array(n);
  const tort = new Float64Array(n), hare = new Float64Array(n), tmp = new Float64Array(n);
  const stepInto = (src: Float64Array, dst: Float64Array) => {
    for (let i = 0; i < n; i++) { const x = src[i] - src[(i + 1) % n]; tmp[i] = x < 0 ? -x : x; }
    dst.set(tmp);
  };
  const eq = (x: Float64Array, y: Float64Array) => { for (let i = 0; i < n; i++) if (x[i] !== y[i]) return false; return true; };

  // binary cycle length of each periodic 0/1 word
  const binLen = new Map<number, number>();
  const binaryLength = (w: number) => {
    let L = binLen.get(w);
    if (L !== undefined) return L;
    L = 0; let y = w;
    do { y = binStep(y, n); L++; } while (y !== w && L < 1e7);
    binLen.set(w, L);
    return L;
  };

  const maxPre = new Int32Array(M + 1).fill(-1);
  const maxPreEx: number[][] = Array.from({ length: M + 1 }, () => []);
  const lengthsSeen = new Map<number, number>();
  let tuples = 0, bfjFail = 0, binLenFail = 0, notZero = 0;
  let firstFail: number[] | null = null;
  const digits = new Int32Array(n - 1);

  for (;;) {
    a[0] = 0;
    let m = 0;
    for (let i = 1; i < n; i++) { a[i] = digits[i - 1]; if (digits[i - 1] > m) m = digits[i - 1]; }
    tuples++;
    // Brent
    let power = 1, lam = 1;
    tort.set(a); stepInto(a, hare);
    while (!eq(tort, hare)) {
      if (power === lam) { tort.set(hare); power *= 2; lam = 0; }
      stepInto(hare, hare); lam++;
    }
    tort.set(a); hare.set(a);
    for (let i = 0; i < lam; i++) stepInto(hare, hare);
    let mu = 0;
    while (!eq(tort, hare)) { stepInto(tort, tort); stepInto(hare, hare); mu++; }
    // tort is on the cycle: scaled binary?
    let c = 0, ok = true, w = 0;
    for (let i = 0; i < n; i++) {
      const x = tort[i];
      if (x === 0) continue;
      if (c === 0) c = x; else if (x !== c) { ok = false; break; }
      w |= 1 << i;
    }
    if (!ok) { bfjFail++; firstFail ??= Array.from(a); }
    else if (c !== 0 && binaryLength(w >>> 0) !== lam) binLenFail++;
    if ((n & (n - 1)) === 0 && c !== 0) notZero++;
    lengthsSeen.set(lam, (lengthsSeen.get(lam) ?? 0) + 1);
    if (mu > maxPre[m]) { maxPre[m] = mu; maxPreEx[m] = Array.from(a); }

    // next tuple (odometer)
    let i = 0;
    while (i < n - 1 && digits[i] === M) { digits[i] = 0; i++; }
    if (i === n - 1) break;
    digits[i]++;
  }
  const run: number[] = [];
  const records: { m: number; preperiod: number; tuple: number[] }[] = [];
  let r = -1;
  for (let m = 0; m <= M; m++) {
    if (maxPre[m] > r) { r = maxPre[m]; records.push({ m, preperiod: r, tuple: maxPreEx[m] }); }
    run.push(r);
  }
  // binary cycle lengths for comparison
  const binaryLengths = new Set<number>();
  for (let x = 0; x < 2 ** n; x++) {
    // only periodic words: walk n steps first to land on a cycle (preperiod ≤ 2-adic part ≤ n)
    let y = x; for (let k = 0; k < n; k++) y = binStep(y, n);
    binaryLengths.add(binaryLength(y));
  }
  const row = {
    n, M, tuples, bfjFail, firstFail, binLenFail, powerOfTwoNotZero: (n & (n - 1)) === 0 ? notZero : null,
    cycleLengths: Object.fromEntries([...lengthsSeen.entries()].sort((x, y) => x[0] - y[0]).map(([k, v]) => [String(k), v])),
    binaryCycleLengths: [...binaryLengths].sort((x, y) => x - y),
    maxPreperiodByBound: run, records, ms: Date.now() - ts,
  };
  partB.push(row);
  console.log(`B: n=${n} M=${M} tuples=${tuples} bfjFail=${bfjFail} binLenFail=${binLenFail} maxPre=${r} lengths=${Object.keys(row.cycleLengths)} binary=${row.binaryCycleLengths} ${row.ms}ms`);
}

writeFileSync('runs/integer.json', JSON.stringify({
  M4, tuplesA, msA, a065677, best,
  recordCounts: best.map((b) => ({ m: b.m, len: b.len, count: recCount[b.m] })),
  partB, totalMs: Date.now() - t0,
}, null, 1));
console.log(`total ${Date.now() - t0} ms`);
