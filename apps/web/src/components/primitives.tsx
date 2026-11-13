import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { approx, clusterColor, int } from "@/lib/format";

export type Tone = "neutral" | "danger" | "success" | "warning";

export function PageHeader({ title, meta, actions, children }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {meta && <div className="mb-3 flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">{meta}</div>}
        <h1 className="font-display text-[34px] font-semibold leading-[1.1]">{title}</h1>
        {children}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, action, children, className, flush }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      {(title || action) && (
        <CardHeader className="border-b px-5 py-4 [.border-b]:pb-4">
          <CardTitle className="text-[16px] font-semibold">{title}</CardTitle>
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={flush ? "p-0" : "p-5"}>{children}</CardContent>
    </Card>
  );
}

const TONE_TEXT: Record<Tone, string> = { neutral: "text-foreground", danger: "text-destructive", success: "text-success", warning: "text-warning" };

export function Stat({ label, value, sub, tone = "neutral", hint }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: Tone; hint?: string }) {
  return (
    <div title={hint}>
      <div className="text-[14px] text-muted-foreground">{label}</div>
      <div className={cn("tabular mt-2 font-display text-[32px] font-semibold leading-none", TONE_TEXT[tone])}>{value}</div>
      {sub && <div className="tabular mt-2 text-[14px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:auto-cols-fr md:grid-flow-col md:grid-cols-none [&>*]:bg-card [&>*]:p-5">{children}</div>;
}

const TAG: Record<Tone, string> = {
  neutral: "border-border bg-transparent text-muted-foreground",
  danger: "border-transparent bg-destructive/15 text-destructive",
  success: "border-transparent bg-success/15 text-success",
  warning: "border-transparent bg-warning/15 text-warning",
};

export function Tag({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-6 rounded-md px-2 text-[13px] font-medium", TAG[tone], className)}>
      {children}
    </Badge>
  );
}

export function ClusterChip({ id, count }: { id: string; count?: number }) {
  return (
    <Link to="/clusters/$id" params={{ id }} className="inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-[14px] transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <span className="size-2 rounded-full" style={{ background: clusterColor(id) }} />
      <span className="font-medium">{id}</span>
      {count !== undefined && <span className="tabular text-muted-foreground">{count}</span>}
    </Link>
  );
}

export function ClusterChips({ ids, max = 3 }: { ids: { id: string; actors?: number }[]; max?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ids.slice(0, max).map((c) => (
        <ClusterChip key={c.id} id={c.id} count={c.actors} />
      ))}
      {ids.length > max && <span className="tabular text-[14px] text-muted-foreground">+{ids.length - max}</span>}
    </div>
  );
}

export function VoiceBar({ apparent, effective, ci, size = "md" }: { apparent: number; effective: number; ci?: [number, number]; size?: "sm" | "md" }) {
  const at = (x: number) => `${Math.max(0, Math.min(1, x / Math.max(1, apparent))) * 100}%`;
  return (
    <div className="w-full">
      <div className={cn("relative w-full rounded-sm bg-destructive/20", size === "sm" ? "h-2" : "h-3")}>
        <div className="absolute inset-y-0 left-0 rounded-sm bg-success" style={{ width: at(Math.max(effective, apparent * 0.01)) }} />
        {ci && size === "md" && [ci[0], ci[1]].map((x, i) => <span key={i} className="absolute -inset-y-1 w-px bg-foreground/70" style={{ left: at(x) }} />)}
      </div>
      {size === "md" && (
        <div className="tabular mt-2.5 flex justify-between text-[14px]">
          <span className="text-success">{approx(effective)} independent</span>
          <span className="text-muted-foreground">{int(apparent)} apparent</span>
        </div>
      )}
    </div>
  );
}

export function Meter({ value, tone = "neutral" }: { value: number; tone?: Tone }) {
  const color = { neutral: "bg-muted-foreground", danger: "bg-destructive", success: "bg-success", warning: "bg-warning" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-sm bg-muted">
      <div className={cn("h-full", color)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function KeyValue({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y">
      {items.map(([k, v], i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-2.5 text-[15px]">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="tabular text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <div className="text-[16px] text-muted-foreground">{title}</div>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Couldn’t load" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-[15px]">
      <span className="min-w-0">
        <span className="font-medium text-destructive">{title}</span>
        <span className="ml-2 break-words text-muted-foreground">{error instanceof Error ? error.message : String(error)}</span>
      </span>
      {onRetry && (
        <button onClick={onRetry} className="rounded-md border border-destructive/40 px-3 py-1.5 text-[14px] hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          Retry
        </button>
      )}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-96 max-w-full" />
      <Skeleton className="h-28" />
      <div className="space-y-px overflow-hidden rounded-xl">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-12 rounded-none" />
        ))}
      </div>
    </div>
  );
}

export const linkRow = "transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none";
