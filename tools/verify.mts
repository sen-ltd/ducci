// Compare the two censuses with OEIS b-files and the published theorems → runs/verify.json
//
//   node tools/verify.mts

import { readFileSync, writeFileSync } from 'node:fs';
import { twoAdic, diffy4 } from '../src/ducci.ts';

const bfile = (a: string): Map<number, bigint> => {
  const m = new Map<number, bigint>();
  for (const line of readFileSync(`ref/b${a}.txt`, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [i, v] = t.split(/\s+/);
    m.set(Number(i), BigInt(v));
  }
  return m;
};

const bin = JSON.parse(readFileSync('runs/binary.json', 'utf8'));
const int = JSON.parse(readFileSync('runs/integer.json', 'utf8'));
interface Check { id: string; title: string; range: string; ok: boolean; detail: string; mismatches?: unknown[] }
const checks: Check[] = [];

// ---------------------------------------------------------------- binary
const rows: any[] = bin.rows;
const N = bin.N;
const cmp = (id: string, title: string, a: string, field: (r: any) => number) => {
  const b = bfile(a);
  const bad: unknown[] = [];
  for (const r of rows) if (BigInt(field(r)) !== b.get(r.n)) bad.push({ n: r.n, ours: field(r), oeis: String(b.get(r.n)) });
  checks.push({ id, title, range: `n ≤ ${N}`, ok: bad.length === 0, detail: `${rows.length - bad.length}/${rows.length} terms equal`, mismatches: bad });
};
cmp('A135547', 'number of cycles of the binary Ducci map', '135547', (r) => r.cycles);
cmp('A111944', 'number of distinct cycle lengths', '111944', (r) => r.distinctLengths);
cmp('A038553', 'longest cycle', '038553', (r) => r.maxLength);

{
  const withAlg = rows.filter((r) => r.algebraCycles !== null);
  const bad = withAlg.filter((r) => r.algebraCycles !== r.cycles || r.algebraLengths !== r.distinctLengths).map((r) => r.n);
  checks.push({ id: 'algebra', title: 'cycles counted by GF(2) algebra (Möbius over fixed-point counts 2^dim ker(Lᵈ + I)) = cycles found by walking', range: `n ≤ ${N} (${withAlg.length} values of n)`, ok: bad.length === 0, detail: bad.length ? `differ at ${bad}` : 'all equal', mismatches: bad });
}
{
  const bad = rows.filter((r) => r.periodic !== r.periodicFormula || !r.periodicCriterionOk).map((r) => r.n);
  checks.push({ id: 'periodic', title: 'periodic words: exactly 2^(n − 2^k) of them (n = 2^k·m, m odd), = the words with even weight on every residue class mod 2^k', range: `every word, n ≤ ${N}`, ok: bad.length === 0, detail: bad.length ? `fails at ${bad}` : 'holds for every word', mismatches: bad });
}
{
  const bad = rows.filter((r) => r.maxPreperiod !== twoAdic(r.n)).map((r) => ({ n: r.n, maxPre: r.maxPreperiod }));
  checks.push({ id: 'A006519', title: 'longest binary preperiod = largest power of 2 dividing n (A006519)', range: `n ≤ ${N}`, ok: bad.length === 0, detail: bad.length ? 'differs' : 'equal for every n', mismatches: bad });
}
{
  const b = bfile('138004');
  const inSeq = new Set([...b.values()].map(Number));
  const bad: number[] = [];
  for (const r of rows) if (r.n % 2 === 1 && r.n > 1) if ((r.distinctLengths === 2) !== inSeq.has(r.n)) bad.push(r.n);
  checks.push({ id: 'A138004', title: 'odd n with all nontrivial cycles of one length (A138004) ⇔ exactly 2 cycle lengths', range: `odd n ≤ ${N}`, ok: bad.length === 0, detail: bad.length ? `differs at ${bad}` : 'agrees', mismatches: bad });
}
{
  const bad = rows.filter((r) => (r.n & (r.n - 1)) === 0 && r.cycles !== 1).map((r) => r.n);
  checks.push({ id: 'pow2-binary', title: 'n = 2^k: every 0/1 word reaches zero (the only cycle is 00…0), within n moves', range: `n ≤ ${N}`, ok: bad.length === 0, detail: bad.length ? `fails at ${bad}` : 'holds', mismatches: bad });
}

// ---------------------------------------------------------------- four-number game
const M4: number = int.M4;
const a065677: number[] = int.a065677;
{
  const b = bfile('065677');
  const bad: unknown[] = [];
  let compared = 0;
  for (const [i, v] of b) { if (i > M4) continue; compared++; if (BigInt(a065677[i]) !== v) bad.push({ m: i, ours: a065677[i], oeis: String(v) }); }
  checks.push({ id: 'A065677', title: 'longest four-number game with every entry ≤ m', range: `m ≤ ${Math.max(...b.keys())} (b-file), computed to ${M4}`, ok: bad.length === 0, detail: `${compared - bad.length}/${compared} published terms equal; extended to m = ${M4}`, mismatches: bad });
}
const inverse = new Map<number, number>(); // length L → least m with A065677(m) ≥ L
for (let m = 0; m <= M4; m++) for (let L = 0; L <= a065677[m]; L++) if (!inverse.has(L)) inverse.set(L, m);
const maxLenReached = a065677[M4];
{
  const b = bfile('065678');
  const bad: unknown[] = [];
  let compared = 0;
  for (let L = 0; L <= maxLenReached; L++) { compared++; if (BigInt(inverse.get(L)!) !== b.get(L)) bad.push({ L, ours: inverse.get(L), oeis: String(b.get(L)) }); }
  // and the next published term really is beyond the census
  const next = b.get(maxLenReached + 1)!;
  checks.push({ id: 'A065678', title: 'least bound m that allows a game of length ≥ L', range: `L ≤ ${maxLenReached}`, ok: bad.length === 0 && next > BigInt(M4), detail: `${compared - bad.length}/${compared} terms equal; next term ${next} > ${M4}`, mismatches: bad });
}
{
  const b = bfile('045794');
  const bad: unknown[] = [];
  let compared = 0;
  for (let L = 1; L + 1 <= maxLenReached; L++) { compared++; if (BigInt(inverse.get(L + 1)!) !== b.get(L)) bad.push({ L }); }
  checks.push({ id: 'A045794', title: 'least largest entry of a quadruple that first becomes constant after L moves (= A065678(L + 1))', range: `L ≤ ${maxLenReached - 1}`, ok: bad.length === 0, detail: `${compared - bad.length}/${compared} terms equal`, mismatches: bad });
}
{
  // formula: a(n) = 3a(n−3) + a(n−6) + a(n−9) for A065678, checked on the b-file itself far beyond the census
  const b = bfile('065678');
  let bad = 0, compared = 0;
  for (let L = 11; b.has(L); L++) { compared++; if (b.get(L)! !== 3n * b.get(L - 3)! + b.get(L - 6)! + b.get(L - 9)!) bad++; }
  checks.push({ id: 'A065678-rec', title: 'Barker\'s recurrence a(L) = 3a(L−3) + a(L−6) + a(L−9) on the A065678 b-file', range: `L = 11 … ${Math.max(...b.keys())}`, ok: bad === 0, detail: `${compared - bad}/${compared} (L = 10 would give 14, the term is 13: the recurrence starts at L = 11)`, mismatches: [] });
}
{
  // the record tuples replay to the claimed lengths
  const bad = int.best.filter((x: any) => diffy4(x.tuple[0], x.tuple[1], x.tuple[2], x.tuple[3]) !== x.len);
  checks.push({ id: 'replay', title: 'every record quadruple replays to its length', range: `${int.best.length} records`, ok: bad.length === 0, detail: bad.length ? 'replay differs' : 'all replay', mismatches: bad });
}

{
  // records are unique up to rotation, reflection, translation and x ↦ m − x:
  // the census counted exactly 2 normal forms (0, b, c, d), b ≤ d, at every record from length 7 on,
  // and the complement of the record is a second, different normal form of the same length.
  const norm = (q: number[]) => {
    const forms: string[] = [];
    for (const s of [q, q.slice().reverse()]) for (let r = 0; r < 4; r++) {
      const c = s.slice(r).concat(s.slice(0, r));
      const mn = Math.min(...c); const d = c.map((x) => x - mn);
      if (d[0] === 0 && d[1] <= d[3]) forms.push(d.join(','));
    }
    return forms.sort()[0];
  };
  const bad: unknown[] = [];
  const rc = int.recordCounts.filter((x: any) => x.len >= 7);
  for (const x of rc) {
    const rec = int.best.find((b: any) => b.m === x.m).tuple as number[];
    const comp = rec.map((v) => x.m - v);
    const distinct = norm(rec) !== norm(comp) && diffy4(comp[0], comp[1], comp[2], comp[3]) === x.len;
    if (x.count !== 2 || !distinct) bad.push(x);
  }
  checks.push({ id: 'unique', title: 'observation: the longest quadruple is unique up to rotation, reflection, adding a constant and x ↦ m − x', range: `lengths 7 … ${maxLenReached}`, ok: bad.length === 0, detail: bad.length ? 'not unique somewhere' : `${rc.length} records, each one pair {q, m − q}`, mismatches: bad });
}

// ---------------------------------------------------------------- general n
for (const r of int.partB) {
  checks.push({ id: `BFJ-${r.n}`, title: `n = ${r.n}: every cycle is c·(0/1 word) and as long as that word's binary cycle (Burmester–Forcade–Jacobs)`, range: `${r.tuples.toLocaleString('en')} tuples, entries ≤ ${r.M}`, ok: r.bfjFail === 0 && r.binLenFail === 0 && Object.keys(r.cycleLengths).every((k) => r.binaryCycleLengths.includes(Number(k))), detail: `cycle lengths seen ${Object.keys(r.cycleLengths).join(', ')}; binary ${r.binaryCycleLengths.join(', ')}`, mismatches: r.firstFail ? [r.firstFail] : [] });
  if (r.powerOfTwoNotZero !== null) checks.push({ id: `pow2-${r.n}`, title: `n = ${r.n}: every integer tuple reaches 00…0 (Ciamberlini–Marengoni 1937)`, range: `entries ≤ ${r.M}`, ok: r.powerOfTwoNotZero === 0, detail: r.powerOfTwoNotZero === 0 ? 'all reach zero' : `${r.powerOfTwoNotZero} do not`, mismatches: [] });
}

{
  // observed: for n = 2^k + 1 the longest preperiod with entries ≤ m is (n − 2)(m − 1) + 1
  for (const r of int.partB) {
    if (![3, 5, 9].includes(r.n)) continue;
    const bad: number[] = [];
    r.maxPreperiodByBound.forEach((v: number, m: number) => { if (m >= 1 && v !== (r.n - 2) * (m - 1) + 1) bad.push(m); });
    checks.push({ id: `pre-${r.n}`, title: `observation, n = ${r.n}: longest preperiod with entries ≤ m is ${r.n - 2}(m − 1) + 1`, range: `1 ≤ m ≤ ${r.M}`, ok: bad.length === 0, detail: bad.length ? `fails at m = ${bad.slice(0, 5)}` : `holds; attained by ${JSON.stringify(r.records[r.records.length - 1].tuple)}`, mismatches: bad });
  }
}

const out = { N, M4, allOk: checks.every((c) => c.ok), checks };
writeFileSync('runs/verify.json', JSON.stringify(out, null, 1));
// the slice of runs/integer.json the page needs (the full file is ~400 KB)
writeFileSync('runs/page.json', JSON.stringify({
  M4, tuplesA: int.tuplesA, best: int.best, recordCounts: int.recordCounts,
  partB: int.partB.map((r: any) => ({ n: r.n, M: r.M, tuples: r.tuples, maxPreperiodByBound: r.n === 3 ? r.maxPreperiodByBound.slice(0, 31) : r.maxPreperiodByBound, last: r.records[r.records.length - 1] })),
}, null, 1));
for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.id.padEnd(12)} ${c.range.padEnd(40)} ${c.detail}`);
console.log(out.allOk ? 'all checks pass' : 'SOME CHECKS FAIL');
