import { describe, it, expect } from 'vitest';
import {
  step, orbit, brent, lengthToZero, diffy4, isScaledBinary, binStep, toBits, fromBits,
  isPeriodicBinary, cyclesByAlgebra, canonical, parseTuple, tribonacci, twoAdic,
} from '../src/ducci.ts';

describe('the Ducci map', () => {
  it('takes cyclic absolute differences', () => {
    expect(step([0, 1, 4, 9])).toEqual([1, 3, 5, 9]);
    expect(step([5, 5, 5])).toEqual([0, 0, 0]);
  });

  it('plays the OEIS A045794 example: 0 1 4 9 reaches 4 4 4 4 in 7 moves, 0000 in 8', () => {
    const o = orbit([0, 1, 4, 9]);
    expect(o.path[7]).toEqual([4, 4, 4, 4]);
    expect(lengthToZero([0, 1, 4, 9])).toBe(8);
    expect(diffy4(0, 1, 4, 9)).toBe(8);
    expect(diffy4(0, 0, 0, 1)).toBe(4);
  });

  it('finds preperiod and period the same way with a stored orbit and with Brent', () => {
    for (const a of [[0, 0, 1], [3, 1, 4, 1, 5], [0, 2, 7, 1, 8, 2], [9, 0, 0, 0, 0, 0, 0]]) {
      const o = orbit(a);
      const [mu, lam] = brent(a);
      expect([mu, lam]).toEqual([o.preperiod, o.period]);
    }
  });

  it('ends odd-length tuples on a cycle of the form c·(0/1 word)', () => {
    for (const a of [[1, 2, 4], [0, 3, 7, 7, 2], [10, 1, 1, 6, 0, 2, 9]]) {
      const [, , onCycle] = brent(a);
      expect(isScaledBinary(onCycle)).toBe(true);
    }
    expect(isScaledBinary([0, 2, 2, 0])).toBe(true);
    expect(isScaledBinary([0, 2, 1])).toBe(false);
  });
});

describe('binary Ducci = rule 102 on a ring', () => {
  it('is x XOR rotate(x) and agrees with the integer map on 0/1 tuples', () => {
    for (let n = 2; n <= 9; n++) {
      for (let x = 0; x < 2 ** n; x++) {
        expect(toBits(binStep(x, n), n)).toEqual(step(toBits(x, n)));
        expect(fromBits(toBits(x, n))).toBe(x);
      }
    }
  });

  it('periodic words are exactly those with even weight on every residue class mod 2^k', () => {
    for (const n of [5, 6, 12]) {
      const onCycle = new Set<number>();
      for (let x = 0; x < 2 ** n; x++) {
        let y = x;
        for (let k = 0; k < n; k++) y = binStep(y, n);
        onCycle.add(y);
      }
      for (let x = 0; x < 2 ** n; x++) expect(isPeriodicBinary(x, n)).toBe(onCycle.has(x));
      expect(onCycle.size).toBe(2 ** (n - twoAdic(n)));
    }
  });

  it('counts cycles by linear algebra = OEIS A135547 / A111944 for small n', () => {
    // n, largest period (A038553), cycles (A135547), distinct lengths (A111944)
    const cases: [number, number, number, number][] = [
      [3, 3, 2, 2], [5, 15, 2, 2], [6, 6, 4, 3], [7, 7, 10, 2], [8, 1, 1, 1], [12, 12, 24, 4], [14, 14, 298, 3], [15, 15, 1096, 4],
    ];
    for (const [n, P, cycles, distinct] of cases) {
      const r = cyclesByAlgebra(n, P);
      expect(r.cycles).toBe(cycles);
      expect(r.lengths.length).toBe(distinct);
    }
  });
});

describe('helpers', () => {
  it('canonical form ignores rotation, reflection and translation', () => {
    expect(canonical([13, 8, 5, 4])).toEqual(canonical([1, 4, 9, 0]));
    expect(canonical([5, 9, 4, 6])).toEqual([0, 2, 1, 5]);
  });

  it('parses tuples and rejects junk', () => {
    expect(parseTuple('0, 1 4  9')).toEqual([0, 1, 4, 9]);
    expect(parseTuple('1')).toBeNull();
    expect(parseTuple('1 -2 3')).toBeNull();
    expect(parseTuple('1 x 3')).toBeNull();
  });

  it('tribonacci numbers (A000073)', () => {
    expect(tribonacci(10)).toEqual([0, 0, 1, 1, 2, 4, 7, 13, 24, 44]);
  });
});
