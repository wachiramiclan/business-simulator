// Simulation maths. No React in here, so it is easy to test and reuse.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function tri(r, a, c, b) {
  if (b <= a) return a;
  const u = r(), F = (c - a) / (b - a);
  return u < F ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
}
const normal = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const pick = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];

export function simulate(v, mod = {}) {
  const N = 2000, M = 12, r = rng(12345);
  const salesMul = mod.sales || 1, costMul = mod.cost || 1;
  const cols = Array.from({ length: M + 1 }, () => []);
  const steady = [];
  let broke = 0;

  for (let i = 0; i < N; i++) {
    const avg = tri(r, v.low, v.mid, v.high) * salesMul;
    const drift = tri(r, 0.95, 1, 1.15) * costMul;
    let cash = v.money - v.start, hit = cash < 0, st = 0;
    cols[0].push(cash);
    for (let m = 1; m <= M; m++) {
      const ramp = v.ramp > 0 && m < v.ramp ? 0.5 + 0.5 * (m / v.ramp) : 1;
      const customers = Math.max(0, avg * ramp * (1 + 0.1 * normal(r)));
      const profit = customers * v.days * (v.price - v.cost * drift) - v.fixed;
      cash += profit;
      if (cash < 0) hit = true;
      cols[m].push(cash);
      if (m > M - 6) st += profit / 6;
    }
    if (hit) broke++;
    steady.push(st);
  }
  cols.forEach((c) => c.sort((a, b) => a - b));
  steady.sort((a, b) => a - b);
  return {
    p10: cols.map((c) => pick(c, 0.1)),
    p50: cols.map((c) => pick(c, 0.5)),
    p90: cols.map((c) => pick(c, 0.9)),
    broke: broke / N,
    s10: pick(steady, 0.1), s50: pick(steady, 0.5), s90: pick(steady, 0.9),
  };
}

export const breakEven = (v) => {
  const unit = v.price - v.cost;
  return unit > 0 ? v.fixed / (v.days * unit) : Infinity;
};

// Turn pasted daily counts into slow / usual / great day estimates.
export function fromRecords(text) {
  const a = text.split(/[\s,;]+/).map(Number).filter((n) => text.trim() && isFinite(n) && n >= 0);
  if (a.length < 5) return null;
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  const sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
  return { low: Math.round(Math.max(0, m - 1.28 * sd)), mid: Math.round(m), high: Math.round(m + 1.28 * sd), days: a.length };
}
