import { useState } from "react";
import { createRoute, Link, notFound, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Eye, EyeOff, FlagTriangleRight, Search, ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ComplaintForm } from "@/routes/complaints";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { actorQuery, queryClient, useActor, useActors, useWatch, useWatchlist } from "@/lib/queries";
import { LAYERS, STATUS_LABEL, ago, date, day, int, num, short } from "@/lib/format";
import { PlatformIcon } from "@/components/platform-icon";

const PLATFORM: Record<string, string> = { x: "X", youtube: "YouTube", telegram: "Telegram", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", sim: "Demo" };
const initials = (h: string) => h.replace(/^akun_/, "").replace(/^@/, "").slice(0, 2).toUpperCase();

function ActorAvatar({ handle, className = "size-8" }: { handle: string; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarFallback className="text-xs font-medium">{initials(handle)}</AvatarFallback>
    </Avatar>
  );
}

function WatchButton({ id, watched }: { id: string; watched: boolean }) {
  const watch = useWatch();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  if (watched)
    return (
      <Button variant="secondary" disabled={watch.isPending} onClick={() => watch.mutate({ id, watch: false }, { onSuccess: () => toast.success("Dihapus dari daftar pantau"), onError: (e) => toast.error(e.message) })}>
        <EyeOff />
        Hentikan pantau
      </Button>
    );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button>
          <Eye />
          Pantau akun
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-3">
        <div className="text-sm font-medium">Catatan untuk daftar pantau</div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsional" rows={3} />
        <Button
          disabled={watch.isPending}
          onClick={() =>
            watch.mutate(
              { id, watch: true, note },
              {
                onSuccess: () => {
                  toast.success("Ditambahkan ke daftar pantau");
                  setOpen(false);
                },
                onError: (e) => toast.error(e.message),
              },
            )
          }
        >
          Simpan
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function Actors() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const { data, isPending } = useActors({ q, filter, page });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const pick = (id: string, on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      on ? n.add(id) : n.delete(id);
      return n;
    });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <InputGroup className="max-w-sm">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Cari pseudonim akun"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </InputGroup>
        <div className="flex items-center gap-2">
          {picked.size > 0 && (
            <Button size="sm" asChild>
              <Link to="/actors/report/$ids" params={{ ids: [...picked].join(",") }}>
                <FlagTriangleRight />
                Laporkan {picked.size} akun
              </Link>
            </Button>
          )}
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filter}
            onValueChange={(v) => {
              if (!v) return;
              setFilter(v);
              setPage(1);
            }}
          >
            <ToggleGroupItem value="all" className="px-3">
              Semua
            </ToggleGroupItem>
            <ToggleGroupItem value="flagged" className="px-3">
              Terkoordinasi
            </ToggleGroupItem>
            <ToggleGroupItem value="watched" className="px-3">
              Dipantau
            </ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" size="sm" asChild>
            <Link to="/actors/watchlist">
              <Eye />
              Daftar pantau
            </Link>
          </Button>
        </div>
      </div>
      {isPending || !data ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : data.rows.length ? (
        <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Pilih semua akun di halaman ini"
                      checked={data.rows.some((x) => x.cases > 0) && data.rows.filter((x) => x.cases > 0).every((x) => picked.has(x.id))}
                      onCheckedChange={(v) => data.rows.filter((x) => x.cases > 0).forEach((x) => pick(x.id, v === true))}
                    />
                  </TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Skor koordinasi</TableHead>
                  <TableHead>Cluster</TableHead>
                  <TableHead className="text-right">Kasus</TableHead>
                  <TableHead className="text-right">Post</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Checkbox aria-label={`Pilih ${r.handle}`} disabled={!r.cases} checked={picked.has(r.id)} onCheckedChange={(v) => pick(r.id, v === true)} />
                    </TableCell>
                    <TableCell>
                      <Link to="/actors/$id" params={{ id: r.id }} onMouseEnter={() => queryClient.prefetchQuery(actorQuery(r.id))} className="flex items-center gap-3 font-medium hover:underline">
                        <ActorAvatar handle={r.handle} />
                        {r.handle}
                        {r.watched && <Badge variant="destructive">Dipantau</Badge>}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <PlatformIcon platform={r.platform} />
                        {PLATFORM[r.platform] ?? r.platform}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{int(r.score)}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{r.cluster ? short(r.cluster) : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.cases || ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{int(r.posts)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {int(data.total)} akun, halaman {data.page} dari {pages}
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
        </>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Belum ada aktor</EmptyTitle>
            <EmptyDescription>Aktor muncul setelah analisis menemukan akun yang saling terkait.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

function Watchlist() {
  const { data } = useWatchlist();
  if (!data) return <Skeleton className="mx-4 h-48 rounded-xl lg:mx-6" />;
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      {data.length ? (
        <ItemGroup className="gap-2">
          {data.map((w) => (
            <Item key={w.actorId} variant="outline" asChild>
              <Link to="/actors/$id" params={{ id: w.actorId }}>
                <ActorAvatar handle={w.profile?.handle ?? w.actorId} className="size-10" />
                <ItemContent>
                  <ItemTitle>{w.profile?.handle ?? short(w.actorId)}</ItemTitle>
                  <ItemDescription>{w.note || `Ditambahkan oleh ${w.addedBy} ${ago(w.createdAt)}`}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  {w.profile?.cluster && <Badge variant="destructive">Aktif di cluster</Badge>}
                  <span className="text-sm text-muted-foreground">{w.profile?.lastPost ? `Post terakhir ${ago(w.profile.lastPost)}` : "Belum ada post"}</span>
                </ItemActions>
              </Link>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Eye />
            </EmptyMedia>
            <EmptyTitle>Daftar pantau kosong</EmptyTitle>
            <EmptyDescription>Pantau akun dari profil aktor atau tab Accounts di sebuah kasus. Cakra Nala memberi alert saat akun itu muncul di operasi baru.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" asChild>
              <Link to="/actors">Lihat aktor</Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}

const activityConfig = { posts: { label: "Post", color: "var(--chart-1)" } } satisfies ChartConfig;

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ActorProfile() {
  const { id } = actorRoute.useParams();
  const a = useActor(id);
  const navigate = useNavigate();
  const reporting = useRouterState({ select: (s) => s.location.pathname.endsWith("/report") });
  const data = a.activity.map((d) => ({ day: new Date(d.day).toLocaleDateString("id-ID", { day: "2-digit", month: "short", timeZone: "Asia/Jakarta" }), posts: d.posts }));
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ActorAvatar handle={a.handle} className="size-14" />
          <div>
            <h1 className="text-2xl font-semibold">{a.handle}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{PLATFORM[a.platform] ?? a.platform}</Badge>
              {a.cluster ? <Badge variant="destructive">Cluster {short(a.cluster.id)}</Badge> : <Badge variant="secondary">Tidak dalam cluster</Badge>}
              {a.watch && <Badge variant="destructive">Dipantau</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {a.cases.length > 0 && (
            <Button variant="outline" asChild>
              <Link to="/actors/$id/report" params={{ id: a.id }}>
                <FlagTriangleRight />
                Laporkan
              </Link>
            </Button>
          )}
          <WatchButton id={a.id} watched={!!a.watch} />
        </div>
      </div>
      <Sheet open={reporting} onOpenChange={(o) => !o && navigate({ to: "/actors/$id", params: { id: a.id } })}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Laporkan {a.handle}</SheetTitle>
            <SheetDescription className="sr-only">Target aduan</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">{reporting && <ComplaintForm actors={[a.id]} onDone={(b) => navigate({ to: "/threats/$id/complaints", params: { id: b.caseIds[0] } })} />}</div>
        </SheetContent>
      </Sheet>
      <div className="grid gap-4 @5xl/main:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Aktivitas 14 hari</CardTitle>
            <CardDescription>
              Sampai {day(a.activityEnd)}, total {int(a.totalPosts)} post
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={activityConfig} className="h-[220px] w-full">
              <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="posts" fill="var(--color-posts)" radius={3} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fakta</CardTitle>
          </CardHeader>
          <CardContent>
            <Fact label="Skor koordinasi" value={int(a.score)} />
            {a.cluster && <Fact label="Ukuran cluster" value={`${a.cluster.size} akun`} />}
            {a.cluster && <Fact label="Dependensi cluster" value={num(a.cluster.rho)} />}
            <Fact label="Akun dibuat" value={a.createdAt ? date(a.createdAt) : "tidak diketahui"} />
            {a.followers !== null && <Fact label="Pengikut" value={int(a.followers)} />}
            <Fact label="Post pertama tercatat" value={a.firstPost ? date(a.firstPost) : "belum ada"} />
            <Fact label="Post terakhir" value={a.lastPost ? ago(a.lastPost) : "belum ada"} />
            {a.watch?.note && <Fact label="Catatan" value={a.watch.note} />}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 @5xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kasus terkait</CardTitle>
            <CardAction>
              <Badge variant="secondary">{a.cases.length}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {a.cases.length ? (
              <ItemGroup className="gap-2">
                {a.cases.map((c) => (
                  <Item key={c.id} variant="outline" size="sm" asChild>
                    <Link to="/threats/$id" params={{ id: c.id }}>
                      <ShieldAlert className="size-4 text-muted-foreground" />
                      <ItemContent>
                        <ItemTitle>{c.title}</ItemTitle>
                        <ItemDescription>Aktivitas terakhir {ago(c.lastSeen)}</ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Badge variant="outline">{STATUS_LABEL[c.status]}</Badge>
                      </ItemActions>
                    </Link>
                  </Item>
                ))}
              </ItemGroup>
            ) : (
              <p className="text-sm text-muted-foreground">Belum terlibat dalam kasus.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rekan terkoordinasi</CardTitle>
            <CardDescription>Akun dengan ikatan koordinasi terkuat</CardDescription>
          </CardHeader>
          <CardContent>
            {a.partners.length ? (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableBody>
                    {a.partners.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link to="/actors/$id" params={{ id: p.id }} className="flex items-center gap-2 font-medium hover:underline">
                            <ActorAvatar handle={p.handle} className="size-6" />
                            {p.handle}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground" title={p.layers.map((l) => LAYERS[l] ?? l).join(", ")}>
                          {p.layers.length} lapis bukti
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{num(p.rho)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Tidak ada ikatan koordinasi pada analisis terakhir.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Post terbaru</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {a.recent.length ? (
            a.recent.map((p) => (
              <div key={p.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{p.action}</Badge>
                  {date(p.ts)}
                </div>
                <p className="text-sm leading-relaxed">{p.text || "Tanpa teks"}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada post tercatat.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const actorsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/actors", staticData: { title: "Actors" }, component: Actors });
export const watchlistRoute = createRoute({ getParentRoute: () => rootRoute, path: "/actors/watchlist", staticData: { title: "Watchlist" }, component: Watchlist });
export const actorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/actors/$id",
  staticData: { title: "Actors" },
  loader: ({ params }) => queryClient.ensureQueryData(actorQuery(params.id)).catch(() => {
    throw notFound();
  }),
  component: ActorProfile,
});

export const actorReportRoute = createRoute({ getParentRoute: () => actorRoute, path: "/report", component: () => null });

function ReportActors() {
  const { ids } = useParams({ strict: false }) as { ids: string };
  const navigate = useNavigate();
  const actors = ids.split(",").filter(Boolean);
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Card className="mx-auto flex h-[calc(100vh-12rem)] w-full max-w-2xl flex-col">
        <CardHeader>
          <CardTitle>Laporkan {actors.length} akun</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          <ComplaintForm actors={actors} onDone={(b) => navigate({ to: "/threats/$id/complaints", params: { id: b.caseIds[0] } })} />
        </CardContent>
      </Card>
    </div>
  );
}

export const reportActorsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/actors/report/$ids", staticData: { title: "Actors" }, component: ReportActors });
