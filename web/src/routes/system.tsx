import { useState } from "react";
import { createRoute, Link } from "@tanstack/react-router";
import { Bot, Clapperboard, ShieldCheck } from "lucide-react";
import { brand, type IconComponent } from "@/components/platform-icon";
import { rootRoute } from "@/routes/root";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAudit, useCapabilities, useCredentials, useLiveState } from "@/lib/queries";
import { date, int, pct, short } from "@/lib/format";
import validation from "@/lib/validation.json";

function Integrations() {
  const caps = useCapabilities();
  const creds = useCredentials();
  const { data: state } = useLiveState();
  const ready = (p: string) => creds.data?.items.filter((c) => c.platform === p && c.active && !(c.cooldownUntil && c.cooldownUntil > Date.now())).length ?? 0;
  const rows: { icon: IconComponent; title: string; text: string; ok: boolean; status: string; to?: string }[] = [
    { icon: brand("x"), title: "X", text: "Pencarian, balasan ke akun, dan percakapan", ok: ready("x") > 0, status: ready("x") ? `${ready("x")} kredensial siap` : "Belum ada kredensial", to: "/credentials" },
    { icon: brand("youtube"), title: "YouTube", text: "Komentar video, tanpa login atau memakai cookie", ok: true, status: ready("youtube") ? `${ready("youtube")} kredensial siap` : "Tanpa login" },
    { icon: brand("telegram"), title: "Telegram", text: "Kanal publik dan jejak penerusan pesan", ok: true, status: "Tanpa login" },
    { icon: brand("tiktok"), title: "TikTok", text: "Lewat sidecar, butuh cookie sesi", ok: !!caps.data?.tiktok && ready("tiktok") > 0, status: !caps.data?.tiktok ? "Sidecar mati" : ready("tiktok") ? `${ready("tiktok")} kredensial siap` : "Belum ada kredensial", to: "/credentials" },
    ...(
      [
        ["instagram", "Instagram", brand("instagram"), "Tagar, akun, dan komentar post lewat browser"],
        ["facebook", "Facebook", brand("facebook"), "Page, pencarian, dan komentar post lewat browser"],
      ] as const
    ).map(([p, title, icon, text]) => ({ icon, title, text, ok: !!caps.data?.meta && ready(p) > 0, status: !caps.data?.meta ? "Browser mati" : ready(p) ? `${ready(p)} kredensial siap` : "Belum ada kredensial", to: "/credentials" })),
    { icon: Bot, title: "Model bahasa", text: "Judul kasus, ringkasan, laporan, dan Perisai", ok: !!caps.data?.reasoner, status: caps.data?.reasoner ? "Terhubung" : "Belum dikonfigurasi" },
    {
      icon: Clapperboard,
      title: "Mode demo",
      text: "Replay skenario fiktif Pulau Seruni",
      ok: !!caps.data?.demo,
      status: caps.data?.demo ? (state?.evaluation ? `Aktif, presisi ${pct(state.evaluation.precision)}, recall ${pct(state.evaluation.recall)}` : "Aktif") : "Mati",
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrasi</CardTitle>
        <CardDescription>Sumber data dan layanan yang terhubung</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup className="grid gap-2 @3xl/main:grid-cols-2">
          {rows.map((r) => (
            <Item key={r.title} variant="outline" size="sm">
              <ItemMedia variant="icon">
                <r.icon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{r.title}</ItemTitle>
                <ItemDescription>{r.text}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge variant={r.ok ? "secondary" : "outline"}>{r.status}</Badge>
                {!r.ok && r.to && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={r.to}>Atur</Link>
                  </Button>
                )}
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

function Validation() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Validasi data nyata</CardTitle>
        <CardDescription>Arsip operasi pengaruh negara yang berlabel, average precision rata-rata {validation[0].seeds} seed</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Arsip</TableHead>
                <TableHead className="text-right">Akun</TableHead>
                <TableHead className="text-right">Akun operasi</TableHead>
                <TableHead className="text-right">Cakra Nala</TableHead>
                <TableHead className="text-right">CI 95%</TableHead>
                <TableHead className="text-right">Jumlah post</TableHead>
                <TableHead className="text-right">Co-share</TableHead>
                <TableHead className="text-right">Acak</TableHead>
                <TableHead className="text-right">Presisi 10 teratas</TableHead>
                <TableHead className="text-right">Tuduhan salah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {validation.map((v) => (
                <TableRow key={v.release}>
                  <TableCell className="font-medium">{v.release.replace(" and ", " dan ")}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(v.accounts)}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(v.operation)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{v.ap.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {v.ci[0].toFixed(2)} sampai {v.ci[1].toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{v.volume.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.coshare.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.random.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(v.precisionAt10)}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.falseAccusations}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditLog() {
  const [page, setPage] = useState(1);
  const { data } = useAudit(page);
  if (!data) return <Skeleton className="h-48 rounded-xl" />;
  const pages = Math.max(1, Math.ceil(data.entries / 15));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rantai audit</CardTitle>
        <CardDescription>{int(data.entries)} entri, setiap entri memuat hash entri sebelumnya</CardDescription>
        <CardAction>
          {data.valid ? (
            <Badge>
              <ShieldCheck />
              Terverifikasi
            </Badge>
          ) : (
            <Badge variant="destructive">Rusak di entri {data.brokenAt}</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Tindakan</TableHead>
                <TableHead>Oleh</TableHead>
                <TableHead>Subjek</TableHead>
                <TableHead className="text-right">Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recent.map((a) => (
                <TableRow key={a.seq}>
                  <TableCell className="text-muted-foreground">{date(a.ts)}</TableCell>
                  <TableCell className="font-mono text-xs">{a.action}</TableCell>
                  <TableCell>{String(a.detail.by ?? "sistem")}</TableCell>
                  <TableCell className="font-mono" title={a.subject}>{short(a.subject)}</TableCell>
                  <TableCell className="text-right font-mono" title={a.hash}>{a.hash.slice(0, 12)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Halaman {page} dari {pages}
          </span>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} onClick={() => setPage((p) => Math.max(1, p - 1))} />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext aria-disabled={page >= pages} className={page >= pages ? "pointer-events-none opacity-50" : "cursor-pointer"} onClick={() => setPage((p) => Math.min(pages, p + 1))} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </CardContent>
    </Card>
  );
}

function System() {
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <Integrations />
      <Validation />
      <AuditLog />
    </div>
  );
}

export const systemRoute = createRoute({ getParentRoute: () => rootRoute, path: "/system", staticData: { title: "System" }, component: System });
