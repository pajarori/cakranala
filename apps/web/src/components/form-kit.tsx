import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Badge variant="outline" className="size-6 justify-center rounded-full p-0 tabular-nums">
            {step}
          </Badge>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">{children}</CardContent>
    </Card>
  );
}

export function Tiles<T extends string>({ value, onChange, items, cols }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; icon?: LucideIcon; badge?: ReactNode }[]; cols: string }) {
  return (
    <ToggleGroup type="single" variant="outline" value={value} onValueChange={(v) => v && onChange(v as T)} className={`grid w-full gap-2 ${cols} *:rounded-lg! *:border-l!`}>
      {items.map((i) => (
        <ToggleGroupItem key={i.id} value={i.id} className="h-auto flex-col gap-2 py-4 data-[state=on]:border-primary">
          {i.icon && <i.icon className="size-5!" />}
          <span className="font-medium">{i.label}</span>
          {i.badge}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function Summary({ title = "Summary", rows, children }: { title?: string; rows: [string, ReactNode][]; children?: ReactNode }) {
  return (
    <div className="@5xl/main:sticky @5xl/main:top-20 @5xl/main:self-start">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col divide-y text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 py-2.5 first:pt-0">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
        {children && <CardFooter className="flex-col gap-2">{children}</CardFooter>}
      </Card>
    </div>
  );
}
