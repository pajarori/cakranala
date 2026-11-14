import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { Case, Overview } from "@/lib/api";
import { int, pct } from "@/lib/format";

function trend(series: number[]) {
  if (series.length < 4) return null;
  const k = Math.max(1, Math.floor(series.length / 6));
  const recent = series.slice(-k).reduce((a, b) => a + b, 0);
  const before = series.slice(-2 * k, -k).reduce((a, b) => a + b, 0);
  return before ? (recent - before) / before : null;
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return (
    <Badge variant="outline">
      <Icon />
      {value >= 0 ? "+" : ""}
      {pct(value)}
    </Badge>
  );
}

export function SectionCards({ cases, overview, running, watched, period }: { cases: Case[]; overview: Overview; running: number; watched: Set<string>; period: string }) {
  const active = cases.filter((c) => c.status !== "dismissed");
  const critical = active.filter((c) => c.severity === "critical" || c.severity === "high").length;
  const fresh = active.filter((c) => c.status === "new").length;
  const apparent = active.reduce((s, c) => s + c.apparent, 0);
  const independent = active.reduce((s, c) => s + c.independent, 0);
  const watchedActive = new Set(active.flatMap((c) => c.members).filter((m) => watched.has(m))).size;
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Kasus</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{active.length}</CardTitle>
          {!!critical && (
            <CardAction>
              <Badge variant="destructive">{critical} tinggi atau kritis</Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">{fresh ? `${fresh} menunggu triase` : "Semua sudah ditriase"}</div>
          <div className="text-muted-foreground">Operasi terkoordinasi {period}</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Post dipantau</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{int(overview.posts)}</CardTitle>
          <CardAction>
            <Delta value={trend(overview.activity.total)} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">{int(overview.accounts)} akun terlihat</div>
          <div className="text-muted-foreground">{running} pantauan berjalan</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Akun terkoordinasi</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{int(overview.coordinated)}</CardTitle>
          <CardAction>
            <Delta value={trend(overview.activity.coordinated)} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">{pct(overview.coordinated / Math.max(1, overview.accounts))} dari semua akun</div>
          <div className="text-muted-foreground">Dalam {active.length} kasus</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Suara independen</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{apparent ? pct(independent / apparent) : "n/a"}</CardTitle>
          {!!watchedActive && (
            <CardAction>
              <Badge variant="destructive">{watchedActive} akun dipantau aktif</Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">
            {int(independent)} dari {int(apparent)} pendukung tampak
          </div>
          <div className="text-muted-foreground">Sisanya amplifikasi buatan</div>
        </CardFooter>
      </Card>
    </div>
  );
}
