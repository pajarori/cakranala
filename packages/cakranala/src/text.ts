import { UnionFind, hash32 } from "./util";

export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[@#]\w+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/(\p{L})\1{2,}/gu, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

export const tokens = (text: string) => normalize(text).split(" ").filter((w) => w.length > 1);

export function shingles(text: string, n = 4) {
  const t = normalize(text);
  const s = new Set<string>();
  for (let i = 0; i + n <= t.length; i++) s.add(t.slice(i, i + n));
  return s;
}

export function jaccard(a: Set<string>, b: Set<string>) {
  let i = 0;
  for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i || 1);
}

const PERMS = 64;
const BANDS = 16;
const A = Array.from({ length: PERMS }, (_, i) => (hash32(`a${i}`) | 1) >>> 0);
const B = Array.from({ length: PERMS }, (_, i) => hash32(`b${i}`));

function signature(set: Set<string>) {
  const sig = new Uint32Array(PERMS).fill(0xffffffff);
  for (const x of set) {
    const h = hash32(x);
    for (let i = 0; i < PERMS; i++) {
      const v = (Math.imul(A[i], h) + B[i]) >>> 0;
      if (v < sig[i]) sig[i] = v;
    }
  }
  return sig;
}

export function nearDuplicateGroups(texts: string[], threshold: number) {
  const sets = texts.map((t) => shingles(t));
  const uf = new UnionFind(texts.length);
  const rows = PERMS / BANDS;
  const buckets = new Map<string, number[]>();
  sets.forEach((s, idx) => {
    if (s.size < 8) return;
    const sig = signature(s);
    for (let b = 0; b < BANDS; b++) {
      const key = `${b}:${Array.from(sig.subarray(b * rows, (b + 1) * rows)).join(",")}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(idx);
      else buckets.set(key, [idx]);
    }
  });
  const seen = new Set<string>();
  for (const bucket of buckets.values()) {
    if (bucket.length < 2 || bucket.length > 500) continue;
    for (let i = 0; i < bucket.length; i++)
      for (let j = i + 1; j < bucket.length; j++) {
        const key = `${bucket[i]}:${bucket[j]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (jaccard(sets[bucket[i]], sets[bucket[j]]) >= threshold) uf.union(bucket[i], bucket[j]);
      }
  }
  return texts.map((_, i) => (sets[i].size < 8 ? -1 : uf.find(i)));
}

export function centered(vectors: Float32Array[]) {
  if (!vectors.length) return [];
  const dim = vectors[0].length;
  const mu = new Float32Array(dim);
  for (const v of vectors) for (let i = 0; i < dim; i++) mu[i] += v[i] / vectors.length;
  return vectors.map((v) => {
    const out = new Float32Array(dim);
    let n = 0;
    for (let i = 0; i < dim; i++) {
      out[i] = v[i] - mu[i];
      n += out[i] * out[i];
    }
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < dim; i++) out[i] /= n;
    return out;
  });
}

export function cosine(a: Float32Array, b: Float32Array) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function kmeans(vectors: Float32Array[], k: number, r: () => number, iterations = 20) {
  const n = vectors.length;
  if (!n) return [];
  k = Math.min(k, n);
  const dim = vectors[0].length;
  const centroids: Float32Array[] = [Float32Array.from(vectors[Math.floor(r() * n)])];
  const best = new Float64Array(n).fill(-1);
  while (centroids.length < k) {
    let total = 0;
    const last = centroids[centroids.length - 1];
    for (let i = 0; i < n; i++) {
      best[i] = Math.max(best[i], cosine(vectors[i], last));
      total += (1 - best[i]) ** 2;
    }
    let x = r() * total;
    let pick = 0;
    for (; pick < n - 1; pick++) if ((x -= (1 - best[pick]) ** 2) <= 0) break;
    centroids.push(Float32Array.from(vectors[pick]));
  }
  const assign = new Int32Array(n).fill(-1);
  for (let it = 0; it < iterations; it++) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      let c = 0;
      let s = -Infinity;
      for (let j = 0; j < k; j++) {
        const v = cosine(vectors[i], centroids[j]);
        if (v > s) {
          s = v;
          c = j;
        }
      }
      if (assign[i] !== c) moved++;
      assign[i] = c;
    }
    if (!moved) break;
    for (let j = 0; j < k; j++) centroids[j] = new Float32Array(dim);
    for (let i = 0; i < n; i++) for (let d = 0; d < dim; d++) centroids[assign[i]][d] += vectors[i][d];
    for (const c of centroids) {
      const norm = Math.sqrt(c.reduce((a, b) => a + b * b, 0)) || 1;
      for (let d = 0; d < dim; d++) c[d] /= norm;
    }
  }
  return Array.from(assign);
}
