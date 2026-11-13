import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { int, num } from "@/lib/format";

export function PageHeader({ eyebrow, title, actions, children }: { eyebrow?: ReactNode; title: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">{eyebrow}</div>}
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.01em] text-fg">{title}</h1>
        {children}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, action, children, className, flush }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cn("overflow-hidden rounded-lg border border-line bg-frame", className)}>
      {(title || action) && (
        <header className="flex h-11 items-center justify-between gap-3 border-b border-line px-4">
          <h2 className="text-[13px] font-medium text-fg">{title}</h2>
          {action}
        </header>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone, title }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "danger" | "success" | "warning" | "info"; title?: string }) {
  const color = tone ? { danger: "text-danger", success: "text-success", warning: "text-warning", info: "text-info" }[tone] : "text-fg";
  return (
    <div title={title}>
      <div className="text-[11.5px] text-fg-3">{label}</div>
      <div className={cn("tabular mt-1.5 font-display text-[24px] font-medium leading-none", color)}>{value}</div>
      {sub && <div className="tabular mt-1.5 text-[11.5px] text-fg-3">{sub}</div>}
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 divide-line overflow-hidden rounded-lg border border-line bg-frame sm:grid-cols-3 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none lg:divide-x [&>*]:p-4">{children}</div>;
}

export function Pill({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "danger" | "warning" | "success" | "info"; className?: string }) {
  const tones = {
    neutral: "border-line-2 text-fg-2",
    danger: "border-transparent bg-danger-soft text-danger",
    warning: "border-transparent bg-warning-soft text-warning",
    success: "border-transparent bg-success-soft text-success",
    info: "border-transparent bg-info-soft text-info",
  };
  return <span className={cn("inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium", tones[tone], className)}>{children}</span>;
}

export function ClusterChip({ id, color, count }: { id: string; color: string; count?: number }) {
  return (
    <Link to="/clusters/$id" params={{ id }} className="inline-flex h-6 items-center gap-1.5 rounded-md border border-line-2 px-2 text-[12px] text-fg-2 transition-colors hover:border-fg-4 hover:text-fg">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {id}
      {count !== undefined && <span className="tabular text-fg-3">{count}</span>}
    </Link>
  );
}

export function VoiceBar({ apparent, effective, ci, size = "md" }: { apparent: number; effective: number; ci?: [number, number]; size?: "sm" | "md" }) {
  const share = Math.max(0.01, Math.min(1, effective / Math.max(1, apparent)));
  const lo = ci ? Math.min(1, ci[0] / Math.max(1, apparent)) : share;
  const hi = ci ? Math.min(1, ci[1] / Math.max(1, apparent)) : share;
  return (
    <div className="w-full">
      <div className={cn("relative w-full overflow-hidden rounded-full bg-danger-soft", size === "sm" ? "h-1.5" : "h-2.5")}>
        <div className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(135deg,var(--danger)_0_2px,transparent_2px_6px)] opacity-40" style={{ width: "100%" }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-success" style={{ width: `${share * 100}%` }} />
        {ci && <div className="absolute inset-y-0 bg-success/40" style={{ left: `${lo * 100}%`, width: `${Math.max(0, hi - lo) * 100}%` }} />}
      </div>
      {size === "md" && (
        <div className="tabular mt-1.5 flex justify-between text-[11.5px]">
          <span className="text-success">{num(effective)} effective</span>
          <span className="text-fg-3">{int(apparent)} apparent</span>
        </div>
      )}
    </div>
  );
}

export function Meter({ value, tone = "neutral" }: { value: number; tone?: "neutral" | "danger" | "success" | "warning" }) {
  const color = { neutral: "bg-fg-3", danger: "bg-danger", success: "bg-success", warning: "bg-warning" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function KeyValue({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line">
      {items.map(([k, v], i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-2 text-[13px]">
          <dt className="text-fg-3">{k}</dt>
          <dd className="tabular text-right text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-2 px-6 py-14 text-center">
      <div className="text-[13.5px] text-fg-2">{title}</div>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-[13px] text-danger">
      <span>{error instanceof Error ? error.message : String(error)}</span>
      {onRetry && (
        <button onClick={onRetry} className="rounded-md border border-danger/40 px-2 py-1 text-[12px] hover:bg-danger/10">
          Retry
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-raised", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
