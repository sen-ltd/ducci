import './style.css';
import binary from '../runs/binary.json';
import integer from '../runs/page.json';
import verify from '../runs/verify.json';
import { step, orbit, brent, isZero, isScaledBinary, parseTuple, diffy4, key } from './ducci.ts';

const B = binary as any;
const I = integer as any;
const V = verify as any;
const M4: number = I.M4;
const best: { len: number; tuple: number[]; m: number }[] = I.best;
// longest game with every entry ≤ m (OEIS A065677), rebuilt from the records
const A065677: number[] = [];
for (let m = 0, j = 0; m <= M4; m++) { while (j + 1 < best.length && best[j + 1].m <= m) j++; A065677.push(best[j].len); }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (x: number) => x.toLocaleString('en-US');
$('m4').textContent = fmt(M4);

// ---------------------------------------------------------------- state
let history: number[][] = [[0, 1, 4, 9]];
let t = 0;
let info = orbit(history[0]);
let playing: number | null = null;

function setStart(a: number[]) {
  stopPlay();
  history = [a];
  t = 0;
  info = orbit(a, 200_000);
  ($('tIn') as HTMLInputElement).value = a.join(' ');
  ($('tIn') as HTMLInputElement).classList.remove('bad');
  render();
}

function stopPlay() {
  if (playing !== null) clearInterval(playing);
  playing = null;
  $('btnPlay').textContent = 'Play ▶';
}

function doStep() {
  if (t === history.length - 1) history.push(step(history[t]));
  t++;
  render();
}

function bound(): number {
  const v = Math.floor(Number(($('mIn') as HTMLInputElement).value));
  return Math.max(1, Math.min(M4, Number.isFinite(v) ? v : 100));
}

function record(m: number) {
  let r = best[0];
  for (const b of best) if (b.m <= m) r = b;
  return r;
}

// ---------------------------------------------------------------- nested polygons
const cv = $<HTMLCanvasElement>('poly');
const ctx = cv.getContext('2d')!;

function drawPoly() {
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const a0 = history[0];
  const n = a0.length;
  const cx = W / 2, cy = H / 2;
  let R = W * 0.43;
  let phase = -Math.PI / 2 - Math.PI / n;
  const shrink = Math.cos(Math.PI / n);
  const levels = Math.min(t + 1, n <= 6 ? 4 : 3);
  const first = t + 1 - levels;
  // rescale so the visible levels fill the canvas
  for (let i = 0; i < first; i++) { phase += Math.PI / n; }
  const maxVal = Math.max(1, ...history[first]);
  for (let lv = 0; lv < levels; lv++) {
    const a = history[first + lv];
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const ang = phase + (2 * Math.PI * i) / n;
      pts.push([cx + R * Math.cos(ang), cy + R * Math.sin(ang)]);
    }
    const isCur = first + lv === t;
    const onCycle = first + lv >= info.preperiod;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.strokeStyle = isCur ? (onCycle ? '#7cc4a4' : '#e3a857') : 'rgba(241,234,217,0.28)';
    ctx.lineWidth = isCur ? 2.5 : 1.2;
    ctx.stroke();
    const fs = Math.max(isCur ? 18 : 13, Math.min(30, R / (n <= 4 ? 5.5 : n * 0.9)));
    ctx.font = `${isCur ? 700 : 500} ${fs}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const [x, y] = pts[i];
      const v = a[i];
      const r = Math.max(fs * 0.75, 4 + 10 * Math.sqrt(v / maxVal));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = v === 0 ? '#1d1f23' : isCur ? (onCycle ? '#2a4a3f' : '#4b3a22') : '#272a30';
      ctx.fill();
      ctx.strokeStyle = isCur ? (onCycle ? '#7cc4a4' : '#e3a857') : '#34373e';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = v === 0 ? '#9c9fa6' : '#ecebe7';
      ctx.fillText(String(v), x, y + 1);
    }
    // next level: vertices at the midpoints of the edges
    R *= shrink;
    phase += Math.PI / n;
  }
}

function render() {
  drawPoly();
  const a0 = history[0];
  const n = a0.length;
  const cur = history[t];
  $('tupleLabel').textContent = `n = ${n}, move ${t}`;
  const last = info.path[info.preperiod];
  const dies = isZero(last);
  // orbit rows
  const shown = Math.max(t + 1, Math.min(info.path.length, 40));
  const rows: string[] = [];
  for (let i = 0; i < Math.min(shown, info.path.length + 0); i++) {
    const a = i < history.length ? history[i] : info.path[i];
    const cls = i === t ? 'cur' : i >= info.preperiod ? 'cyc' : '';
    rows.push(`<div class="row ${cls}" data-i="${i}"><span class="ix">${i}</span>${a.map((x) => `<span class="${x === 0 ? 'z' : ''}">${x}</span>`).join('')}</div>`);
  }
  if (info.path.length > shown) rows.push(`<div class="row dim">… ${fmt(info.path.length - shown)} more</div>`);
  $('rows').innerHTML = rows.join('');
  $('rows').querySelectorAll<HTMLElement>('.row[data-i]').forEach((el) =>
    el.addEventListener('click', () => {
      const i = Number(el.dataset.i);
      while (history.length <= i) history.push(step(history[history.length - 1]));
      t = i; stopPlay(); render();
    }),
  );
  $('moveInfo').textContent = `move ${t}`;
  const c = Math.max(...last);
  const word = last.map((x) => (x ? 1 : 0)).join('');
  $('status').innerHTML = dies
    ? `Reaches <b>all zeros after ${info.preperiod} moves</b>${n === 4 ? ' (the "Diffy length")' : ''}.`
    : `Enters a <b>cycle of length ${fmt(info.period)}</b> after <b>${info.preperiod}</b> moves. On the cycle every number is 0 or ${c}: ` +
      `<span class="word">${c} × ${word}</span>${isScaledBinary(last) ? '' : ' (?!)'}.`;
  // puzzle score
  const m = bound();
  if (n === 4) {
    const mx = Math.max(...a0) - Math.min(...a0);
    const rec = record(m);
    const len = diffy4(a0[0], a0[1], a0[2], a0[3]);
    const fits = mx <= m;
    $('score').innerHTML = fits
      ? `Puzzle (m = ${fmt(m)}): your game lasts <b>${len}</b> moves; the longest possible is <b>${A065677[m]}</b>` +
        (len === A065677[m] ? ' — <span class="ok">optimal</span>.' : `, e.g. <span class="mono">${rec.tuple.join(' ')}</span>.`)
      : `Puzzle: the spread (largest − smallest = ${fmt(mx)}) exceeds m = ${fmt(m)}; raise m or use smaller numbers.`;
  } else {
    $('score').innerHTML = `<span class="dim">The puzzle score appears for four numbers.</span>`;
  }
  void cur;
}

// ---------------------------------------------------------------- controls
const rnd = (k: number) => Math.floor(Math.random() * k);
$('btnSet').addEventListener('click', () => {
  const a = parseTuple(($('tIn') as HTMLInputElement).value);
  if (!a) { ($('tIn') as HTMLInputElement).classList.add('bad'); return; }
  setStart(a);
});
($('tIn') as HTMLInputElement).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnSet').click(); });
$('btnRand4').addEventListener('click', () => setStart(Array.from({ length: 4 }, () => rnd(bound() + 1))));
$('btnRand5').addEventListener('click', () => setStart(Array.from({ length: 5 }, () => rnd(30))));
$('btnRand8').addEventListener('click', () => setStart(Array.from({ length: 8 }, () => rnd(60))));
$('btnBits').addEventListener('click', () => setStart(Array.from({ length: 15 }, () => rnd(2))));
$('btnBest').addEventListener('click', () => setStart(record(bound()).tuple.slice()));
$('mIn').addEventListener('change', () => render());
$('btnStep').addEventListener('click', () => { stopPlay(); doStep(); });
$('btnStart').addEventListener('click', () => { stopPlay(); t = 0; render(); });
$('btnPlay').addEventListener('click', () => {
  if (playing !== null) { stopPlay(); return; }
  if (t >= info.path.length - 1) t = 0;
  $('btnPlay').textContent = 'Pause ❚❚';
  playing = window.setInterval(() => {
    if (t >= info.path.length - 1) { stopPlay(); return; }
    doStep();
  }, 650);
});

// ---------------------------------------------------------------- rule 102 spacetime
const st = $<HTMLCanvasElement>('spacetime');
const sctx = st.getContext('2d')!;
let word: number[] = [];

function drawSpacetime() {
  const n = word.length;
  const W = st.width, H = st.height;
  sctx.fillStyle = '#17191c';
  sctx.fillRect(0, 0, W, H);
  const cell = Math.max(2, Math.min(Math.floor(W / n), 24));
  const rowsN = Math.floor(H / Math.max(2, Math.min(cell, 12)));
  const ch = Math.floor(H / rowsN);
  const x0 = Math.floor((W - cell * n) / 2);
  let mu = -1, lam = -1;
  if (n <= 40) { [mu, lam] = brent(word); }
  let a = word;
  for (let r = 0; r < rowsN; r++) {
    const onCyc = mu >= 0 && r >= mu;
    for (let i = 0; i < n; i++) {
      if (a[i]) {
        sctx.fillStyle = onCyc ? '#7cc4a4' : '#e3a857';
        sctx.fillRect(x0 + i * cell, r * ch, cell - (cell > 4 ? 1 : 0), ch - (ch > 4 ? 1 : 0));
      }
    }
    a = step(a);
  }
  if (mu >= 0) {
    sctx.strokeStyle = 'rgba(124,196,164,0.6)';
    sctx.setLineDash([6, 6]);
    sctx.beginPath(); sctx.moveTo(0, mu * ch); sctx.lineTo(W, mu * ch); sctx.stroke();
    sctx.setLineDash([]);
  }
  const row = B.rows.find((r: any) => r.n === n);
  $('bInfo').innerHTML = `preperiod <b>${mu}</b>, period <b>${fmt(lam)}</b>` +
    (row ? ` · for n = ${n}: ${fmt(row.cycles)} cycles, lengths ${Object.keys(row.lengths).join(', ')}` : '');
}
function bn() { return Math.max(3, Math.min(40, Math.floor(Number(($('bIn') as HTMLInputElement).value)) || 21)); }
$('btnBRand').addEventListener('click', () => { word = Array.from({ length: bn() }, () => rnd(2)); drawSpacetime(); });
$('btnBOne').addEventListener('click', () => { const n = bn(); word = Array.from({ length: n }, (_, i) => (i === n - 1 ? 1 : 0)); drawSpacetime(); });
$('btnBTwo').addEventListener('click', () => { const n = bn(); word = Array.from({ length: n }, (_, i) => (i >= n - 2 ? 1 : 0)); drawSpacetime(); });
$('bIn').addEventListener('change', () => $('btnBTwo').click());

// ---------------------------------------------------------------- chart: A065677
function drawChart() {
  const svg = $('chart');
  const W = 760, H = 300, L = 48, R = 16, T = 14, Bm = 36;
  const lx = (m: number) => L + ((Math.log10(m) - 0) / Math.log10(M4)) * (W - L - R);
  const maxLen = A065677[M4] + 1;
  const ly = (v: number) => H - Bm - (v / maxLen) * (H - T - Bm);
  let s = '';
  for (let v = 0; v <= maxLen; v += 4) s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${ly(v)}" y2="${ly(v)}"/><text x="${L - 6}" y="${ly(v) + 4}" text-anchor="end">${v}</text>`;
  for (const m of [1, 10, 100, 1000]) if (m <= M4) s += `<line class="grid" x1="${lx(m)}" x2="${lx(m)}" y1="${T}" y2="${H - Bm}"/><text x="${lx(m)}" y="${H - Bm + 16}" text-anchor="middle">${m}</text>`;
  s += `<text x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">bound m (log scale)</text>`;
  let d = '';
  for (let m = 1; m <= M4; m++) {
    const x = lx(m), y = ly(A065677[m]);
    d += m === 1 ? `M${x},${y}` : `H${x}V${y}`;
  }
  d += `H${lx(M4)}`;
  s += `<path d="${d}" fill="none" stroke="#e3a857" stroke-width="2"/>`;
  const b065677max = 72;
  s += `<line x1="${lx(b065677max)}" x2="${lx(b065677max)}" y1="${T}" y2="${H - Bm}" stroke="#7cc4a4" stroke-dasharray="4 4"/>`;
  s += `<text x="${lx(b065677max) + 4}" y="${T + 12}" fill="#7cc4a4" style="fill:#7cc4a4">OEIS b-file ends (m = 72)</text>`;
  for (const b of best) if (b.m >= 1) s += `<circle cx="${lx(b.m)}" cy="${ly(b.len)}" r="3" fill="#7cc4a4"><title>length ${b.len} first possible at m = ${b.m}: ${b.tuple.join(' ')}</title></circle>`;
  svg.innerHTML = s;
  $('chartNote').textContent = `Each dot is the least bound at which a longer game becomes possible. Three more moves cost a factor q² ≈ 3.38 in the bound, q the tribonacci constant (q² is a root of y³ − 3y² − y − 1, the recurrence of A065678). ${fmt(I.tuplesA)} quadruples tried.`;
}

// ---------------------------------------------------------------- side panels
function renderSide() {
  const cs: any[] = V.checks;
  $('checkHead').textContent = `— ${cs.filter((c) => c.ok).length}/${cs.length} pass`;
  $('checks').innerHTML = cs.map((c) =>
    `<div class="chk-row"><b class="${c.ok ? 'ok' : 'ng'}">${c.ok ? '✓' : '✗'}</b> <b>${c.id}</b> ${c.title}<div class="where">${c.range}</div><div class="detail">${c.detail}</div></div>`,
  ).join('');
  $('records').innerHTML = `<table><tr><th>length</th><th class="num">least m</th><th>quadruple</th></tr>` +
    best.filter((b) => b.len > 0).map((b) => `<tr data-q="${b.tuple.join(' ')}" class="click"><td>${b.len}</td><td class="num">${fmt(b.m)}</td><td class="mono">${b.tuple.join(' ')}</td></tr>`).join('') + '</table>';
  $('records').querySelectorAll<HTMLElement>('tr[data-q]').forEach((tr) => tr.addEventListener('click', () => setStart(tr.dataset.q!.split(' ').map(Number))));
  $('binTable').innerHTML = `<table><tr><th>n</th><th class="num">cycles</th><th class="num">lengths</th><th class="num">longest</th><th class="num">pre</th></tr>` +
    B.rows.map((r: any) => `<tr><td>${r.n}</td><td class="num">${fmt(r.cycles)}</td><td class="num">${r.distinctLengths}</td><td class="num">${fmt(r.maxLength)}</td><td class="num">${r.maxPreperiod}</td></tr>`).join('') + '</table>';
}

setStart(record(bound()).tuple.slice());
for (let i = 0; i < 6; i++) doStep();
$('btnBTwo').click();
drawChart();
renderSide();
void key;
