import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { State } from "@/lib/api";
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

export function SectionCards({ state, watched }: { state: State; watched: Set<string> }) {
  const active = state.cases.filter((c) => c.active && c.status !== "dismissed");
  const critical = active.filter((c) => c.severity === "critical" || c.severity === "high").length;
  const fresh = state.cases.filter((c) => c.status === "new" && c.active).length;
  const stats = state.report?.stats;
  const apparent = active.reduce((s, c) => s + c.apparent, 0);
  const independent = active.reduce((s, c) => s + c.independent, 0);
  const running = state.monitors.filter((m) => m.active).length;
  const watchedActive = new Set((state.report?.clusters ?? []).flatMap((c) => c.members).filter((m) => watched.has(m))).size;
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Kasus aktif</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{active.length}</CardTitle>
          {!!critical && (
            <CardAction>
              <Badge variant="destructive">{critical} tinggi atau kritis</Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">{fresh ? `${fresh} menunggu triase` : "Semua sudah ditriase"}</div>
          <div className="text-muted-foreground">Operasi terkoordinasi 24 jam terakhir</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Post dipantau</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{int(stats?.events ?? 0)}</CardTitle>
          <CardAction>
            <Delta value={trend(state.activity.total)} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">{int(stats?.actors ?? 0)} akun terlihat</div>
          <div className="text-muted-foreground">{running} pantauan berjalan</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Akun terkoordinasi</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{int(stats?.flaggedActors ?? 0)}</CardTitle>
          <CardAction>
            <Delta value={trend(state.activity.coordinated)} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">{pct((stats?.flaggedActors ?? 0) / Math.max(1, stats?.actors ?? 1))} dari semua akun</div>
          <div className="text-muted-foreground">Dalam {state.report?.clusters.length ?? 0} cluster terkoordinasi</div>
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
