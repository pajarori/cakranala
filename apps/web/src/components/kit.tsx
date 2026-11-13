import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-frame shadow-soft", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-[12px] font-medium uppercase tracking-wider text-fg-3">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Field(props: React.ComponentProps<"input">) {
  return <input {...props} className={cn("h-8 rounded-md border border-line-2 bg-raised px-2.5 text-[13px] text-fg outline-none placeholder:text-fg-4 focus:border-fg-3", props.className)} />;
}

export function Metric({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "danger" | "success" | "warning" }) {
  const color = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-fg";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className={cn("tabular mt-1 text-xl font-medium", color)}>{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-fg-3">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line-2 p-6 text-center text-fg-3">{children}</div>;
}
