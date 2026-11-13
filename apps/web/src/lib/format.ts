const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const num = (x: number) => number.format(x);
export const int = (x: number) => integer.format(x);
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const ratio = (x: number) => `×${number.format(x)}`;
export const approx = (x: number) => `≈${number.format(x)}`;
export const range = (ci: [number, number]) => `${number.format(ci[0])} to ${number.format(ci[1])}`;
export const clock = (ts: number) => new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
export const date = (ts: number) => new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const HUES = ["#c9a66b", "#8fa3b8", "#b48ead", "#a3a07a", "#7fa0a0", "#c48f6a", "#9a8fb8", "#b8a58f"];
export const clusterColor = (id: string) => HUES[(Number(id.replace(/\D/g, "")) - 1 + HUES.length) % HUES.length];

export const LAYERS: Record<string, { name: string; short: string }> = {
  coaction: { name: "Co-action", short: "ACT" },
  coframing: { name: "Semantic co-framing", short: "SEM" },
  copypasta: { name: "Copypasta", short: "TXT" },
  rhythm: { name: "Rhythm", short: "RHY" },
  lifecycle: { name: "Account lifecycle", short: "LIF" },
};
