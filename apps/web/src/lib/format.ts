const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export const num = (x: number) => number.format(x);
export const int = (x: number) => integer.format(x);
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const ratio = (x: number) => `${number.format(x)}×`;
export const approx = (x: number) => `≈${integer.format(x)}`;
export const clock = (ts: number) => new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const thisYear = (ts: number) => new Date(ts).getFullYear() === new Date().getFullYear();
export const date = (ts: number) => `${new Date(ts).toLocaleString("id-ID", { day: "2-digit", month: "short", year: thisYear(ts) ? undefined : "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB`;
export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function ago(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "baru saja";
  if (s < 3600) return `${Math.round(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.round(s / 3600)} jam lalu`;
  if (s < 30 * 86400) return `${Math.round(s / 86400)} hari lalu`;
  return new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
}

const GRAPH = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];
const bucket = (id: string, n: number) => [...id].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7) % n;
export const graphColor = (id: string) => GRAPH[bucket(id, GRAPH.length)];
export const short = (id: string) => id.slice(0, 8);

export const LAYERS: Record<string, string> = {
  coaction: "Co-action",
  coframing: "Semantic co-framing",
  copypasta: "Copypasta",
  rhythm: "Rhythm",
  lifecycle: "Account lifecycle",
};

export const SEVERITY_VARIANT = { critical: "destructive", high: "destructive", medium: "secondary", low: "outline" } as const;
export const STATUS_LABEL = { new: "Baru", investigating: "Diselidiki", confirmed: "Terkonfirmasi", dismissed: "Diabaikan" } as const;
export const SEVERITY_LABEL = { critical: "Kritis", high: "Tinggi", medium: "Sedang", low: "Rendah" } as const;
export const ESCALATION_LABEL = { watch: "Pantau", alert: "Siaga", urgent: "Darurat" } as const;
