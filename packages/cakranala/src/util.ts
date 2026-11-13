export type Rng = () => number;

export function rng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

export function gauss(r: Rng, mean = 0, sd = 1) {
  const u = Math.max(r(), 1e-12);
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

export const expo = (r: Rng, mean: number) => -Math.log(Math.max(r(), 1e-12)) * mean;

export function hash32(s: string, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}\u0001${b}` : `${b}\u0001${a}`);
export const splitPair = (k: string) => k.split("\u0001") as [string, string];

export function quantile(xs: number[], q: number) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function groupBy<T, K>(xs: Iterable<T>, key: (x: T) => K) {
  const m = new Map<K, T[]>();
  for (const x of xs) {
    const k = key(x);
    const g = m.get(k);
    if (g) g.push(x);
    else m.set(k, [x]);
  }
  return m;
}

export class UnionFind {
  private p: number[];
  constructor(n: number) {
    this.p = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    while (this.p[i] !== i) i = this.p[i] = this.p[this.p[i]];
    return i;
  }
  union(a: number, b: number) {
    this.p[this.find(a)] = this.find(b);
  }
}

export function randomPairQuantile(n: number, sim: (i: number, j: number) => number, q: number, r: Rng, samples = 4000) {
  if (n < 2) return 1;
  const xs: number[] = [];
  for (let k = 0; k < samples; k++) {
    const i = Math.floor(r() * n);
    const j = Math.floor(r() * n);
    if (i !== j) xs.push(sim(i, j));
  }
  return quantile(xs, q);
}

export function poissonTail(k: number, lambda: number) {
  if (k <= 0) return 1;
  let term = Math.exp(-lambda);
  let cdf = term;
  for (let i = 1; i < k; i++) {
    term *= lambda / i;
    cdf += term;
  }
  if (cdf < 1 - 1e-12) return 1 - cdf;
  let tail = 0;
  term = Math.exp(-lambda + k * Math.log(lambda) - logFactorial(k));
  for (let i = k; i < k + 200 && term > 1e-300; i++) {
    tail += term;
    term *= lambda / (i + 1);
  }
  return tail;
}

function logFactorial(k: number) {
  let s = 0;
  for (let i = 2; i <= k; i++) s += Math.log(i);
  return s;
}

export function shuffle<T>(r: Rng, xs: T[]) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function binomialTail(k: number, n: number, p: number) {
  if (k <= 0) return 1;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let lg = 0;
  const logChoose = (i: number) => {
    let s = 0;
    for (let j = 1; j <= i; j++) s += Math.log((n - i + j) / j);
    return s;
  };
  let tail = 0;
  for (let i = k; i <= n; i++) {
    lg = logChoose(i) + i * Math.log(p) + (n - i) * Math.log(1 - p);
    tail += Math.exp(lg);
  }
  return Math.min(1, tail);
}

function fmix(h: number) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export function uuidFrom(input: string) {
  const hex = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b].map((seed) => fmix(hash32(input, seed)).toString(16).padStart(8, "0")).join("");
  const v = `${hex.slice(0, 12)}5${hex.slice(13, 16)}${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17)}`;
  return `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20, 32)}`;
}

export function lgamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  const g = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  x -= 1;
  let a = g[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += g[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export function nbTail(k: number, mu: number, dispersion: number) {
  if (k <= 0) return 1;
  if (mu <= 0) return 0;
  if (dispersion <= 1e-9) return poissonTail(k, mu);
  const r = 1 / dispersion;
  const q = mu / (mu + r);
  const logPmf = (i: number) => lgamma(i + r) - lgamma(r) - lgamma(i + 1) + r * Math.log(1 - q) + i * Math.log(q);
  if (k <= mu) {
    let cdf = 0;
    let term = Math.exp(logPmf(0));
    for (let i = 0; i < k; i++) {
      cdf += term;
      term *= ((i + r) / (i + 1)) * q;
    }
    return Math.max(0, Math.min(1, 1 - cdf));
  }
  let tail = 0;
  let term = Math.exp(logPmf(k));
  for (let i = k; i < k + 100000 && term > tail * 1e-14 && term > 1e-320; i++) {
    tail += term;
    term *= ((i + r) / (i + 1)) * q;
  }
  return Math.min(1, tail);
}

export function cauchyCombine(ps: number[]) {
  if (!ps.length) return 1;
  const clipped = ps.map((p) => Math.min(Math.max(p, 1e-300), 0.5));
  const t = clipped.reduce((s, p) => s + (p < 1e-15 ? 1 / (p * Math.PI) : Math.tan((0.5 - p) * Math.PI)), 0) / ps.length;
  const acat = t > 1e15 ? 1 / (t * Math.PI) : 0.5 - Math.atan(t) / Math.PI;
  return Math.min(1, acat, ps.length * Math.min(...clipped));
}

export function partialConjunction(ps: number[], u: number) {
  const f = ps.length;
  if (!f) return 1;
  const k = Math.max(1, Math.min(u, f));
  const sorted = [...ps].sort((a, b) => a - b);
  return Math.min(1, (f - k + 1) * sorted[k - 1]);
}
