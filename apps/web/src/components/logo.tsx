import { cn } from "@/lib/utils";

const NODES = [
  [16, 4, true],
  [24.49, 7.51, true],
  [28, 16, false],
  [24.49, 24.49, false],
  [16, 28, false],
  [7.51, 24.49, false],
  [4, 16, false],
  [7.51, 7.51, true],
] as const;

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("size-5", className)}>
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16L16 4M16 16L24.49 7.51M16 16L28 16M16 16L24.49 24.49M16 16L16 28M16 16L7.51 24.49M16 16L4 16M16 16L7.51 7.51" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.51 7.51L24.49 7.51" stroke="var(--destructive)" strokeWidth="2" />
      {NODES.map(([x, y, hot]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={hot ? 3.2 : 2.5} fill={hot ? "var(--destructive)" : "currentColor"} />
      ))}
      <circle cx="16" cy="16" r="3.5" fill="currentColor" />
    </svg>
  );
}
