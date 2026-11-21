// Binary census: every n-bit word for every n ≤ N, the Ducci map x ↦ x XOR rot(x) walked once
// from every word (two bitsets of 2^n bits). For each n: number of cycles, the distinct cycle
// lengths, the longest cycle, how many words are periodic, the longest and the histogram of
// preperiods; then the same cycles counted again by GF(2) linear algebra.
//
//   node tools/binary.mts [N=31]       → runs/binary.json (rewritten after every n)
//   (n = 31: 2³¹ words, about 3 minutes and 512 MB of bitsets)

import { writeFileSync, mkdirSync } from 'node:fs';
import { binStep, twoAdic, cyclesByAlgebra } from '../src/ducci.ts';

const N = Number(process.argv[2] ?? 31);
mkdirSync('runs', { recursive: true });

interface Row {
  n: number; words: number; cycles: number; lengths: Record<string, number>; distinctLengths: number;
  maxLength: number; maxLengthExample: number[]; periodic: number; periodicFormula: number; periodicCriterionOk: boolean;
  maxPreperiod: number; preperiodHist: number[]; algebraCycles: number | null; algebraLengths: number | null; ms: number;
}
const rows: Row[] = [];

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const popParity = (v: number) => {
  v ^= v >>> 16; v ^= v >>> 8; v ^= v >>> 4; v ^= v >>> 2; v ^= v >>> 1;
  return v & 1;
};

const t0 = Date.now();
for (let n = 1; n <= N; n++) {
  const ts = Date.now();
  const W = 2 ** n;
  const bytes = Math.ceil(W / 8);
  const seen = new Uint8Array(bytes);
  const onCycle = new Uint8Array(bytes);
  const has = (b: Uint8Array, x: number) => (b[x >>> 3] >> (x & 7)) & 1;
  const set = (b: Uint8Array, x: number) => { b[x >>> 3] |= 1 << (x & 7); };

  const lengths = new Map<number, number>();
  let maxLen = 0, maxLenStart = 0, periodic = 0;
  const path: number[] = [];

  for (let x0 = 0; x0 < W; x0++) {
    if (has(seen, x0)) continue;
    path.length = 0;
    let x = x0;
    while (!has(seen, x)) { set(seen, x); path.push(x); x = binStep(x, n); }
    // x was seen; is it on this walk? then this walk closed a new cycle
    if (path.lastIndexOf(x) >= 0) {
      let len = 0, y = x;
      do { set(onCycle, y); len++; y = binStep(y, n); } while (y !== x);
      lengths.set(len, (lengths.get(len) ?? 0) + 1);
      periodic += len;
      if (len > maxLen) { maxLen = len; maxLenStart = x; }
    }
  }

  // second pass: preperiod of every word = moves until it lands on a cycle,
  // and the periodic-word criterion (each residue class mod 2^k has even weight) for every word
  const p2 = twoAdic(n);
  const classMasks: number[] = [];
  for (let r = 0; r < p2; r++) { let m = 0; for (let i = r; i < n; i += p2) m |= 1 << i; classMasks.push(m >>> 0); }
  const hist: number[] = [];
  let maxPre = 0, criterionOk = true;
  for (let x = 0; x < W; x++) {
    let crit = 1;
    for (let r = 0; r < p2; r++) if (popParity((x & classMasks[r]) >>> 0)) { crit = 0; break; }
    const cyc = has(onCycle, x);
    if (crit !== cyc) criterionOk = false;
    let j = 0, y = x;
    while (!has(onCycle, y)) { y = binStep(y, n); j++; }
    hist[j] = (hist[j] ?? 0) + 1;
    if (j > maxPre) maxPre = j;
  }

  let cycles = 0;
  for (const c of lengths.values()) cycles += c;
  const lens = [...lengths.keys()].sort((a, b) => a - b);
  const P = lens.reduce((a, b) => (a / gcd(a, b)) * b, 1);
  let algebra: { cycles: number; lengths: number[] } | null = null;
  if (P <= 1e7) algebra = cyclesByAlgebra(n, P);

  const row: Row = {
    n, words: W, cycles, lengths: Object.fromEntries(lens.map((l) => [String(l), lengths.get(l)!])),
    distinctLengths: lens.length, maxLength: maxLen,
    maxLengthExample: Array.from({ length: n }, (_, i) => (maxLenStart >>> i) & 1),
    periodic, periodicFormula: 2 ** (n - p2), periodicCriterionOk: criterionOk,
    maxPreperiod: maxPre, preperiodHist: Array.from(hist, (v) => v ?? 0),
    algebraCycles: algebra ? algebra.cycles : null, algebraLengths: algebra ? algebra.lengths.length : null,
    ms: Date.now() - ts,
  };
  rows.push(row);
  console.log(`n=${n} cycles=${cycles} distinct=${lens.length} maxLen=${maxLen} maxPre=${maxPre} periodic=${periodic}/${row.periodicFormula} crit=${criterionOk} algebra=${algebra?.cycles} ${row.ms}ms`);
  writeFileSync('runs/binary.json', JSON.stringify({ N: n, totalMs: Date.now() - t0, rows }, null, 1));
}
