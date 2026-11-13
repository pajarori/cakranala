const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const num = (x: number) => number.format(x);
export const int = (x: number) => integer.format(x);
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const ratio = (x: number) => `×${number.format(x)}`;
export const clock = (ts: number) => new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
export const date = (ts: number) => new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const HUES = ["#e5646a", "#e0a85a", "#7aa7e8", "#5fc992", "#c58af0", "#4fd1c5", "#f08ac0", "#b8c46a", "#8fb3ff", "#ffb48a"];
export const clusterColor = (id: string) => HUES[(Number(id.replace(/\D/g, "")) - 1 + HUES.length) % HUES.length];

export const LAYERS: Record<string, { name: string; short: string }> = {
  coaction: { name: "Co-action", short: "ACT" },
  coframing: { name: "Semantic co-framing", short: "SEM" },
  copypasta: { name: "Copypasta", short: "TXT" },
  rhythm: { name: "Rhythm", short: "RHY" },
  lifecycle: { name: "Account lifecycle", short: "LIF" },
};
