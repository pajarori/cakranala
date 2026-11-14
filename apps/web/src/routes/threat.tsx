import { createRoute, Link, notFound, Outlet, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { CircleCheck, Download, Eye, EyeOff, FileText } from "lucide-react";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Counterfactual } from "@/components/counterfactual";
import { NetworkGraph } from "@/components/graph";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ensureState, useCreateReport, useOps, useSetStatus, useWatch, useWatchlist } from "@/lib/queries";
import { ESCALATION_LABEL, LAYERS, SEVERITY_LABEL, SEVERITY_VARIANT, STATUS_LABEL, ago, approx, clock, date, graphColor, int, num, pct, ratio, short } from "@/lib/format";
import { inflation, profile } from "@/lib/profile";
import type { CaseStatus } from "@/lib/api";

function useCase() {
  const { id } = threatRoute.useParams();
  const state = useOps();
  const c = state.cases.find((x) => x.id === id)!;
  const narratives = state.report?.narratives.filter((n) => c.narratives.includes(n.id)).sort((a, b) => b.supporters - a.supporters) ?? [];
  const clusters = state.report?.clusters.filter((k) => c.clusters.includes(k.id)) ?? [];
  return { state, c, narratives, clusters };
}

const TABS = [
  { value: "summary", to: "/threats/$id", label: "Summary" },
  { value: "evidence", to: "/threats/$id/evidence", label: "Evidence" },
  { value: "network", to: "/threats/$id/network", label: "Network" },
  { value: "accounts", to: "/threats/$id/accounts", label: "Accounts" },
] as const;

function ThreatLayout() {
  const { c, clusters } = useCase();
  const navigate = useNavigate();
  const setStatus = useSetStatus();
  const report = useCreateReport();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const tab = TABS.find((t) => t.value !== "summary" && path.includes(`/${t.value}`))?.value ?? "summary";
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono text-foreground" title={c.id}>{short(c.id)}</span>
            <Badge variant={SEVERITY_VARIANT[c.severity]}>{SEVERITY_LABEL[c.severity]}</Badge>
            {c.active && (
              <Badge variant={c.escalation === "urgent" ? "destructive" : c.escalation === "alert" ? "default" : "secondary"}>{ESCALATION_LABEL[c.escalation]}</Badge>
            )}
            {!c.active && <Badge variant="outline">Tidak aktif</Badge>}
            <span>Pertama terlihat {date(c.firstSeen)}</span>
            <span>Aktivitas terakhir {ago(c.lastSeen)}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold">{c.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={c.status} onValueChange={(v) => setStatus.mutate({ id: c.id, status: v as CaseStatus }, { onSuccess: () => toast.success(`Ditandai ${STATUS_LABEL[v as CaseStatus].toLowerCase()}`) })}>
            <SelectTrigger className="w-40" aria-label="Status kasus">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {c.active && (
            <Button variant="outline" asChild>
              <a href={`/api/cases/${c.id}/stix`} download>
                <Download />
                STIX
              </a>
            </Button>
          )}
          <Button disabled={!c.active || report.isPending} onClick={() => report.mutate(c.id, { onSuccess: (r) => navigate({ to: "/reports/$id", params: { id: r.id } }), onError: (e) => toast.error(e.message) })}>
            {report.isPending ? <Spinner /> : <FileText />}
            Buat laporan
          </Button>
        </div>
      </div>
      <Tabs value={tab}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} asChild>
              <Link to={t.to} params={{ id: c.id }}>
                {t.label}
                {t.value === "accounts" && <Badge variant="secondary">{clusters.reduce((s, k) => s + k.members.length, 0)}</Badge>}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {c.active ? (
        <Outlet />
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Tidak aktif dalam 24 jam terakhir</EmptyTitle>
            <EmptyDescription>Bukti kembali muncul saat akun-akun ini bergerak lagi.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

const RESPONSE = {
  watch: ["Lanjutkan pemantauan", "Tinjau bukti"],
  alert: ["Tugaskan analis", "Buat laporan komandan", "Siapkan klarifikasi publik"],
  urgent: ["Laporkan ke komandan sekarang", "Terbitkan klarifikasi di kanal resmi", "Laporkan akun ke platform", "Buat laporan komandan"],
};

function Summary() {
  const { c, narratives, clusters } = useCase();
  const lead = narratives[0];
  const coordinated = clusters.reduce((s, k) => s + k.members.length, 0);
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[
          ["Pendukung tampak", int(c.apparent), "Akun yang mendorong narasi ini"],
          ["Suara independen", approx(c.independent), "Nilai dukungan yang sebenarnya"],
          ["Inflasi", ratio(inflation({ supporters: c.apparent, sie: { value: c.independent } })), "Pendukung tampak dibagi suara independen"],
          ["Akun terkoordinasi", int(coordinated), `Dalam ${clusters.length} cluster`],
        ].map(([label, value, foot]) => (
          <Card key={label} className="@container/card">
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
            </CardHeader>
            <CardFooter className="text-sm text-muted-foreground">{foot}</CardFooter>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Respons</CardTitle>
          <CardAction>
            <Badge variant="outline">{ESCALATION_LABEL[c.escalation]}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 @xl/main:grid-cols-2">
            {RESPONSE[c.escalation].map((r) => (
              <li key={r} className="flex items-center gap-2">
                <CircleCheck className="size-4 text-muted-foreground" />
                {r}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {!!c.disarm.length && (
        <Card>
          <CardHeader>
            <CardTitle>Teknik DISARM</CardTitle>
            <CardDescription>DISARM Framework, CC BY-SA 4.0</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {c.disarm.map((t) => (
              <Badge key={t.id} variant="outline" asChild>
                <a href={t.url} target="_blank" rel="noreferrer">
                  <span className="font-mono">{t.id}</span>
                  {t.name}
                </a>
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
      {c.brief && (
        <Card>
          <CardHeader>
            <CardTitle>Penilaian</CardTitle>
            <CardDescription>Yang tampaknya didorong operator</CardDescription>
          </CardHeader>
          <CardContent className="leading-relaxed">{c.brief}</CardContent>
        </Card>
      )}
      {lead && (
        <Card>
          <CardHeader>
            <CardTitle>Tanpa operasi</CardTitle>
            <CardDescription>Volume narasi utama, dengan dan tanpa akun terkoordinasi</CardDescription>
          </CardHeader>
          <CardContent>
            <Counterfactual narrative={lead} height={260} />
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 @5xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Narasi</CardTitle>
            <CardDescription>Pesan yang didorong dalam operasi ini</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue={narratives[0]?.id}>
              {narratives.map((n) => (
                <AccordionItem key={n.id} value={n.id}>
                  <AccordionTrigger className="gap-4">
                    <span className="line-clamp-2 text-left">{n.sample}</span>
                    <Badge variant={n.verdict === "manufactured" ? "destructive" : "secondary"} className="shrink-0">
                      {n.verdict === "manufactured" ? "Buatan" : "Organik"}
                    </Badge>
                  </AccordionTrigger>
                  <AccordionContent className="flex flex-col gap-3">
                    <p className="leading-relaxed">“{n.sample}”</p>
                    <Progress value={Math.max(1, (n.sie.value / Math.max(1, n.supporters)) * 100)} aria-label="Porsi independen" />
                    <div className="flex justify-between text-sm text-muted-foreground tabular-nums">
                      <span>{approx(n.sie.value)} independen (SIE)</span>
                      <span>{int(n.supporters)} tampak</span>
                    </div>
                    {!!n.tags.length && (
                      <div className="flex flex-wrap gap-1.5">
                        {n.tags.map((t) => (
                          <Badge key={t} variant="outline">
                            #{t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Operator</CardTitle>
            <CardDescription>Cluster terkoordinasi di balik narasi</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {clusters.map((k) => (
              <div key={k.id} className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: graphColor(k.id) }} />
                  <span className="font-medium" title={k.id}>Cluster <span className="font-mono">{short(k.id)}</span></span>
                  <Badge variant="outline">{profile(k)}</Badge>
                  <span className="ml-auto text-sm text-muted-foreground tabular-nums">{k.members.length} akun</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Mulai</div>
                    <div className="tabular-nums">{clock(k.forensics.onset.ts)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Gelombang</div>
                    <div className="tabular-nums">{k.forensics.waves}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Kadens</div>
                    <div className="tabular-nums">{k.forensics.cadence ? `${num(k.forensics.cadence.medianSec)} detik` : "n/a"}</div>
                  </div>
                </div>
                {(k.forensics.rotation ?? 0) >= 0.7 && <p className="mt-3 text-sm text-destructive">Akun memposting dengan urutan yang sama di setiap gelombang, indikasi otomatisasi.</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Evidence() {
  const { state, clusters } = useCase();
  const decoy = state.report?.null.decoyFdr ?? 0;
  return (
    <div className="flex flex-col gap-4">
      {clusters.map((k) => {
        const rows = [...k.layers].sort((a, b) => b.meanObserved / Math.max(b.meanExpected, 0.001) - a.meanObserved / Math.max(a.meanExpected, 0.001));
        return (
          <Card key={k.id}>
            <CardHeader>
              <CardTitle title={k.id}>Cluster <span className="font-mono">{short(k.id)}</span></CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Cluster p {k.p <= 0.05 ? "≤ 0.05" : num(k.p)}</Badge>
                <Badge variant="outline">Skor {int(k.score)}</Badge>
                <Badge variant="outline">Decoy FDR {pct(decoy)}</Badge>
                {k.families.map((f) => (
                  <Badge key={f.layers.join()} variant="secondary">
                    {f.layers.map((l) => LAYERS[l] ?? l).join(" dan ")} {int(f.strength)}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead>Lapis bukti</TableHead>
                      <TableHead className="text-right">Pasangan akun</TableHead>
                      <TableHead className="text-right">Teramati</TableHead>
                      <TableHead className="text-right">Harapan acak</TableHead>
                      <TableHead className="text-right">Di atas acak</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((l) => {
                      const x = l.meanObserved / Math.max(l.meanExpected, 0.001);
                      return (
                        <TableRow key={l.layer}>
                          <TableCell className="font-medium">{LAYERS[l.layer] ?? l.layer}</TableCell>
                          <TableCell className="text-right tabular-nums">{l.pairs}</TableCell>
                          <TableCell className="text-right tabular-nums">{num(l.meanObserved)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{l.meanExpected < 0.01 ? "di bawah 0,01" : num(l.meanExpected)}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{x >= 1000 ? `${Math.round(x / 1000)}k×` : ratio(x)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const ALL_LAYERS = Object.keys(LAYERS);

function Network() {
  const { state, c } = useCase();
  const { actor } = useParams({ strict: false }) as { actor?: string };
  const navigate = useNavigate();
  const a = actor ? state.actors.find((x) => x.id === actor) : undefined;
  return (
    <div className="grid gap-4 @5xl/main:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="overflow-hidden py-0">
        <NetworkGraph
          view={state}
          focus={c.clusters}
          layers={ALL_LAYERS}
          selected={actor ?? null}
          onSelect={(id) => navigate(id ? { to: "/threats/$id/network/$actor", params: { id: c.id, actor: id } } : { to: "/threats/$id/network", params: { id: c.id } })}
          height="min(70vh, 640px)"
        />
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{a?.handle ?? "Pilih akun"}</CardTitle>
          <CardDescription>{a ? (() => { const k = state.report?.clusters.find((x) => x.members.includes(a.id)); return k ? `Cluster ${short(k.id)}` : "Akun organik"; })() : "Klik node untuk melihat detail"}</CardDescription>
        </CardHeader>
        {a && (
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ikatan</span>
              <span className="tabular-nums">{state.report?.edges.filter((e) => e.a === a.id || e.b === a.id).length}</span>
            </div>
            {a.followers !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pengikut</span>
                <span className="tabular-nums">{int(a.followers)}</span>
              </div>
            )}
            {a.createdAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Akun dibuat</span>
                <span>{date(a.createdAt)}</span>
              </div>
            )}
            {a.label && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Label simulasi</span>
                <span>{a.label}</span>
              </div>
            )}
            <Button variant="outline" className="mt-2" asChild>
              <Link to="/actors/$id" params={{ id: a.id }}>
                Buka profil aktor
              </Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function Accounts() {
  const { state, clusters } = useCase();
  const { data: watch } = useWatchlist();
  const toggle = useWatch();
  const watched = new Set((watch ?? []).map((w) => w.actorId));
  const handle = (id: string) => state.actors.find((a) => a.id === id)?.handle ?? short(id);
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead>Akun</TableHead>
            <TableHead>Cluster</TableHead>
            <TableHead>Peran</TableHead>
            <TableHead className="text-right">Skor</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {clusters.flatMap((k) => {
            const seeders = new Map(k.forensics.seeders.map((s) => [s.actor, s.leadScore]));
            return k.members.map((m) => (
              <TableRow key={m}>
                <TableCell>
                  <Link to="/actors/$id" params={{ id: m }} className="flex items-center gap-3 font-medium hover:underline">
                    <Avatar className="size-7">
                      <AvatarFallback className="text-xs">{handle(m).replace(/^akun_/, "").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {handle(m)}
                  </Link>
                </TableCell>
                <TableCell className="font-mono" title={k.id}>{short(k.id)}</TableCell>
                <TableCell className="text-muted-foreground">{seeders.has(m) ? `Pemicu, memposting lebih dulu ${Math.round(seeders.get(m)! * 100)}% waktu` : "Penguat"}</TableCell>
                <TableCell className="text-right tabular-nums">{int(state.report?.scores[m] ?? 0)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant={watched.has(m) ? "secondary" : "ghost"}
                    size="sm"
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ id: m, watch: !watched.has(m) }, { onSuccess: () => toast.success(watched.has(m) ? "Dihapus dari daftar pantau" : "Ditambahkan ke daftar pantau"), onError: (e) => toast.error(e.message) })}
                  >
                    {watched.has(m) ? <EyeOff /> : <Eye />}
                    {watched.has(m) ? "Dipantau" : "Pantau"}
                  </Button>
                </TableCell>
              </TableRow>
            ));
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export const threatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/threats/$id",
  staticData: { title: "Threats" },
  loader: async ({ params }) => {
    const state = await ensureState();
    if (!state.cases.some((c) => c.id === params.id)) throw notFound();
  },
  component: ThreatLayout,
});

const networkTab = createRoute({ getParentRoute: () => threatRoute, path: "/network", component: Network });

export const threatTabs = [
  createRoute({ getParentRoute: () => threatRoute, path: "/", component: Summary }),
  createRoute({ getParentRoute: () => threatRoute, path: "/evidence", component: Evidence }),
  networkTab.addChildren([createRoute({ getParentRoute: () => networkTab, path: "/$actor", component: () => null })]),
  createRoute({ getParentRoute: () => threatRoute, path: "/accounts", component: Accounts }),
];
