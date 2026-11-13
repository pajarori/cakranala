const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const num = (x: number) => number.format(x);
export const int = (x: number) => integer.format(x);
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const ratio = (x: number) => `${number.format(x)}×`;
export const approx = (x: number) => `≈${integer.format(x)}`;
export const clock = (ts: number) => new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
export const date = (ts: number) => new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function ago(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

const GRAPH = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];
export const graphColor = (id: string) => GRAPH[(Number(id.replace(/\D/g, "")) - 1 + GRAPH.length) % GRAPH.length];
export const chartVar = (id: string) => `var(--chart-${((Number(id.replace(/\D/g, "")) - 1) % 5) + 1})`;

export const LAYERS: Record<string, string> = {
  coaction: "Co-action",
  coframing: "Semantic co-framing",
  copypasta: "Copypasta",
  rhythm: "Rhythm",
  lifecycle: "Account lifecycle",
};

export const SEVERITY_VARIANT = { critical: "destructive", high: "destructive", medium: "secondary", low: "outline" } as const;
export const STATUS_LABEL = { new: "New", investigating: "Investigating", confirmed: "Confirmed", dismissed: "Dismissed" } as const;
