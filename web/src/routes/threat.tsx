import { useState } from "react";
import { createRoute, Link, notFound, Outlet, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { CircleCheck, Download, Eye, EyeOff, FileText, FlagTriangleRight, History, Layers3, RefreshCw, Users, Waypoints } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { AnalystDisposition } from "@/components/analyst-disposition";
import { PlatformIcon } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Counterfactual } from "@/components/counterfactual";
import { NetworkGraph } from "@/components/graph";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { failure } from "@/components/error-dialog";
import { ensureState, evidenceQuery, proofQuery, useCreateReport, useDecision, useOps, useRedescribe, useSetStatus, useWatch, useWatchlist } from "@/lib/queries";
import { ESCALATION_LABEL, LAYERS, SEVERITY_LABEL, SEVERITY_VARIANT, STATUS_LABEL, ago, approx, date, day, graphColor, int, num, pct, ratio, short, span } from "@/lib/format";
import { inflation, profile } from "@/lib/profile";
import type { CaseStatus, Proof, State } from "@/lib/api";

function useCase() {
  const { id } = threatRoute.useParams();
  const live = useOps();
  const c = live.cases.find((x) => x.id === id)!;
  const ev = useQuery({ ...evidenceQuery(id), enabled: !c.active }).data;
  const state: State = c.active || !ev ? live : { ...live, report: { ...live.report, ...ev.report } as State["report"], actors: ev.actors };
  const narratives = state.report?.narratives.filter((n) => c.narratives.includes(n.id)).sort((a, b) => b.supporters - a.supporters) ?? [];
  const clusters = state.report?.clusters.filter((k) => c.clusters.includes(k.id)) ?? [];
  return { state, c, narratives, clusters, ev };
}

const TABS = [
  { value: "summary", to: "/threats/$id", label: "Summary" },
  { value: "evidence", to: "/threats/$id/evidence", label: "Evidence" },
  { value: "network", to: "/threats/$id/network", label: "Network" },
  { value: "accounts", to: "/threats/$id/accounts", label: "Accounts" },
  { value: "complaints", to: "/threats/$id/complaints", label: "Aduan" },
] as const;

function ThreatLayout() {
  const { c, clusters, ev } = useCase();
  const navigate = useNavigate();
  const setStatus = useSetStatus();
  const report = useCreateReport();
  const redescribe = useRedescribe();
  const coordinated = useDecision(c.id).data?.verdict === "coordinated";
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
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
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
            <Button variant="outline" disabled={redescribe.isPending} onClick={() => redescribe.mutate(c.id, { onSuccess: () => toast.success("Ringkasan diperbarui"), onError: (e) => toast.error(e.message) })}>
              {redescribe.isPending ? <Spinner /> : <RefreshCw />}
              Perbarui ringkasan
            </Button>
          )}
          {(c.active || ev) && (
            <Button variant="outline" asChild>
              <a href={`/api/cases/${c.id}/stix`} download>
                <Download />
                STIX
              </a>
            </Button>
          )}
          {coordinated ? (
            <Button variant="outline" asChild>
              <Link to="/threats/$id/complaints/new" params={{ id: c.id }}>
                <FlagTriangleRight />
                Laporkan
              </Link>
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button variant="outline" disabled>
                    <FlagTriangleRight />
                    Laporkan
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Isi keputusan analis dengan verdict terkoordinasi dulu</TooltipContent>
            </Tooltip>
          )}
          <Button disabled={(!c.active && !ev) || report.isPending} onClick={() => report.mutate(c.id, { onSuccess: (r) => navigate({ to: "/reports/$id", params: { id: r.id } }), onError: failure("Laporan tidak bisa dibuat") })}>
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
        <TabsContent value={tab} asChild>
          <div className="flex flex-col gap-4">
            {!c.active && ev && (
              <Alert>
                <History />
                <AlertTitle>Kasus tidak aktif</AlertTitle>
                <AlertDescription>
                  Bukti dari jendela analisis terakhir, {date(ev.window.from)} sampai {date(ev.window.to)}.
                </AlertDescription>
              </Alert>
            )}
            {c.active || ev ? (
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

const RESPONSE = {
  watch: ["Lanjutkan pemantauan", "Tinjau bukti"],
  alert: ["Tugaskan analis", "Buat laporan komandan", "Siapkan klarifikasi publik"],
  urgent: ["Laporkan ke komandan sekarang", "Terbitkan klarifikasi di kanal resmi", "Laporkan akun ke platform", "Buat laporan komandan"],
};

const PROFILE_TEXT: Record<string, string> = {
  Terskrip: "Akun memposting dengan urutan yang sama di setiap gelombang, indikasi otomatisasi.",
  "Bertempo manusia": "Pesan serupa ditulis ulang dengan kata berbeda pada tempo manusia.",
  "Salin tempel": "Akun menyebarkan teks atau tautan yang identik.",
};

function Provenance({ caseId }: { caseId: string }) {
  const p = useQuery(evidenceQuery(caseId)).data?.provenance;
  if (!p) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Asal bukti</CardTitle>
        <CardDescription>Konteks agar analisis bisa diulang, dianalisis {date(p.generatedAt)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 @3xl/main:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Post anggota</dt>
          <dd className="text-right font-medium tabular-nums">{int(p.events)}</dd>
          <dt className="text-muted-foreground">Null replicates</dt>
          <dd className="text-right font-medium tabular-nums">{int(p.replicates)}</dd>
          <dt className="text-muted-foreground">Target FDR</dt>
          <dd className="text-right font-medium tabular-nums">{pct(p.fdr)}</dd>
          <dt className="text-muted-foreground">Layer</dt>
          <dd className="flex flex-wrap justify-end gap-1">
            {p.layers.map((l) => (
              <Badge key={l} variant="outline">
                {LAYERS[l] ?? l}
              </Badge>
            ))}
          </dd>
        </dl>
        {p.sources.length ? (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Pantauan sumber</TableHead>
                  <TableHead>Target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.sources.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <span className="flex items-center gap-2 font-medium">
                        <PlatformIcon platform={m.platform} className="size-4 shrink-0" />
                        {m.label}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-0 truncate text-muted-foreground">{m.target}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Pantauan sumber tidak tercatat.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Summary() {
  const { c, narratives, clusters, state } = useCase();
  const handles = new Map(state.actors.map((a) => [a.id, a.handle ?? a.id]));
  const points = [...new Set(clusters.flatMap((k) => k.forensics.talkingPoints))];
  const lead = narratives[0];
  const coordinated = clusters.reduce((s, k) => s + k.members.length, 0);
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[
          ...(narratives.length
            ? [
                ["Pendukung tampak", int(c.apparent), "Akun yang mendorong narasi ini"],
                ["Suara independen", approx(c.independent), "Nilai dukungan yang sebenarnya"],
                ["Inflasi", ratio(inflation({ supporters: c.apparent, sie: { value: c.independent } })), "Pendukung tampak dibagi suara independen"],
              ]
            : [
                ["Anggota kasus", int(c.members.length), "Semua akun yang pernah terlibat"],
                ["Gelombang serentak", int(clusters.reduce((s, k) => s + k.forensics.waves, 0)), "Posting bersama dalam waktu berdekatan"],
                ["Pertama terlihat", day(c.firstSeen), `Terakhir ${day(c.lastSeen)}`],
              ]),
          ["Akun terkoordinasi", int(coordinated), `Dalam ${clusters.length} kelompok pada analisis terakhir`],
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
      <AnalystDisposition caseId={c.id} />
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
            {!narratives.length && (
              <ul className="flex flex-col gap-3">
                {points.map((t) => (
                  <li key={t} className="rounded-lg border p-3 leading-relaxed">
                    “{t}”
                  </li>
                ))}
              </ul>
            )}
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
            <CardTitle>Jaringan pelaku</CardTitle>
            <CardDescription>Kelompok akun yang bergerak bersama mendorong narasi ini</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {clusters.map((k, i) => (
              <div key={k.id} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: graphColor(k.id) }} />
                  <span className="font-medium" title={k.id}>
                    Kelompok {i + 1}
                  </span>
                  <Badge variant="outline">{profile(k)}</Badge>
                  <span className="ml-auto text-sm text-muted-foreground tabular-nums">{k.members.length} akun</span>
                </div>
                <p className="text-sm text-muted-foreground">{PROFILE_TEXT[profile(k)]}</p>
                <dl className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Mulai bergerak</dt>
                    <dd className="text-right tabular-nums">
                      {date(k.forensics.onset.ts)}, {k.forensics.onset.actors} akun dalam {span(k.forensics.onset.windowSec)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Gelombang posting serentak</dt>
                    <dd className="tabular-nums">{k.forensics.waves}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Jeda khas antar post</dt>
                    <dd className="tabular-nums">{k.forensics.cadence ? span(k.forensics.cadence.medianSec) : "tidak teratur"}</dd>
                  </div>
                </dl>
                {!!k.forensics.seeders.length && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Penggerak awal</span>
                    {k.forensics.seeders.slice(0, 3).map((s) => (
                      <Badge key={s.actor} variant="secondary" asChild>
                        <Link to="/actors/$id" params={{ id: s.actor }}>
                          {handles.get(s.actor) ?? short(s.actor)}
                        </Link>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const ACTION = { reshare: "membagikan ulang", reply: "membalas", quote: "mengutip" } as Record<string, string>;

function Burst({ sample }: { sample: Proof["copies"][number]["sample"] }) {
  return (
    <Table className="min-w-[420px]" containerProps={{ tabIndex: 0, "aria-label": "Daftar akun pada bukti burst", className: "rounded-lg border" }}>
      <TableBody>
          {sample.map((s) => (
            <TableRow key={s.actor + s.ts}>
              <TableCell>
                <Link to="/actors/$id" params={{ id: s.actor }} className="font-medium hover:underline">
                  {s.handle}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{date(s.ts)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
  );
}

function Shared({ title, rows, format }: { title: string; rows: Proof["tags"]; format: (k: string) => string }) {
  return (
    <Table className="min-w-[420px]" containerProps={{ tabIndex: 0, "aria-label": `${title} bersama`, className: "rounded-lg border" }}>
      <TableHeader className="bg-muted">
          <TableRow>
            <TableHead>{title}</TableHead>
            <TableHead className="text-right">Akun</TableHead>
            <TableHead className="text-right">Post</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell className="max-w-0 truncate font-medium">{format(r.key)}</TableCell>
              <TableCell className="text-right tabular-nums">{int(r.accounts)}</TableCell>
              <TableCell className="text-right tabular-nums">{int(r.posts)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
  );
}

function Evidence() {
  const { state, clusters, c } = useCase();
  const { data: p, isPending } = useQuery(proofQuery(c.id));
  const decoy = state.report?.null.decoyFdr ?? 0;
  return (
    <div className="flex flex-col gap-4">
      {isPending ? (
        <Card>
          <CardContent className="flex items-center gap-2 text-muted-foreground">
            <Spinner />
            Mengumpulkan bukti dari post anggota
          </CardContent>
        </Card>
      ) : p ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Teks identik dari akun berbeda</CardTitle>
              <CardDescription>
                Dari {int(p.posts)} post {int(p.accounts)} akun anggota, {day(p.span.from)} sampai {day(p.span.to)}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {p.copies.length ? (
                <Accordion type="single" collapsible defaultValue={p.copies[0].key}>
                  {p.copies.map((g) => (
                    <AccordionItem key={g.key} value={g.key}>
                      <AccordionTrigger className="items-start gap-3 px-6 py-4">
                        <span className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                          <span className="min-w-0 line-clamp-2 text-left text-sm font-medium leading-6">{g.text}</span>
                          <span className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                            <Badge variant="destructive">{int(g.accounts)} akun</Badge>
                            <Badge variant="outline">{int(g.posts)} post</Badge>
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="flex flex-col gap-4 px-6 pb-4">
                        <p className="whitespace-pre-line leading-relaxed">{g.text}</p>
                        <p className="text-muted-foreground">
                          {g.burst.accounts} akun memposting teks ini dalam {span(g.burst.seconds)}. Pertama {date(g.first)}, terakhir {date(g.last)}.
                        </p>
                        <Burst sample={g.sample} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-muted-foreground">Tidak ada teks yang sama persis antar akun.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Aksi serentak pada post yang sama</CardTitle>
              <CardDescription>Akun berbeda membagikan ulang, membalas, atau mengutip post yang sama</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {p.actions.length ? (
                <Accordion type="single" collapsible>
                  {p.actions.map((g) => (
                    <AccordionItem key={g.key} value={g.key}>
                      <AccordionTrigger className="items-start gap-3 px-6 py-4">
                        <span className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                          <span className="min-w-0 line-clamp-2 text-left text-sm font-medium leading-6">{int(g.accounts)} akun {ACTION[g.action] ?? g.action} {g.targetText ? `“${g.targetText}”` : `post ${g.target.replace(/^x:/, "")}`}</span>
                          <span className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                            <Badge variant="destructive">{g.burst.accounts} akun</Badge>
                            <Badge variant="outline">{g.posts} aksi</Badge>
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="flex flex-col gap-4 px-6 pb-4">
                        <p className="text-muted-foreground">
                          {int(g.posts)} aksi. Pertama {date(g.first)}, terakhir {date(g.last)}.
                        </p>
                        <Burst sample={g.sample} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-muted-foreground">Tidak ada aksi bersama pada post yang sama.</p>
              )}
            </CardContent>
          </Card>
          {!!(p.tags.length || p.urls.length) && (
            <Card>
              <CardHeader>
                <CardTitle>Tagar dan tautan bersama</CardTitle>
                <CardDescription>Dipakai berulang oleh banyak akun anggota</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 px-6 pb-6 @5xl/main:grid-cols-2">
                {!!p.tags.length && <Shared title="Tagar" rows={p.tags} format={(k) => `#${k}`} />}
                {!!p.urls.length && <Shared title="Tautan" rows={p.urls} format={(k) => k} />}
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
      {clusters.map((k, i) => {
        const rows = [...k.layers].sort((a, b) => b.meanObserved / Math.max(b.meanExpected, 0.001) - a.meanObserved / Math.max(a.meanExpected, 0.001));
        return (
          <Card key={k.id}>
            <CardHeader>
              <CardTitle title={k.id}>Uji statistik kelompok {i + 1}</CardTitle>
              <CardDescription>Seberapa jauh kemiripan perilaku antar akun melampaui kebetulan acak</CardDescription>
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
              <Table className="min-w-[620px]" containerProps={{ tabIndex: 0, "aria-label": `Statistik bukti kelompok ${i + 1}`, className: "rounded-lg border" }}>
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
            </CardContent>
          </Card>
        );
      })}
      <Provenance caseId={c.id} />
    </div>
  );
}

const ALL_LAYERS = Object.keys(LAYERS);

function Network() {
  const { state, c } = useCase();
  const { actor } = useParams({ strict: false }) as { actor?: string };
  const navigate = useNavigate();
  const [layers, setLayers] = useState(ALL_LAYERS);
  const report = state.report;
  const clusterIds = new Set(c.clusters);
  const members = new Set(report?.clusters.filter((cluster) => clusterIds.has(cluster.id)).flatMap((cluster) => cluster.members) ?? []);
  const edges = report?.edges.filter((edge) => members.has(edge.a) && members.has(edge.b)) ?? [];
  const actors = state.actors.filter((item) => members.has(item.id));
  const a = actor ? state.actors.find((x) => x.id === actor) : undefined;
  const selectedCluster = a ? report?.clusters.find((cluster) => cluster.members.includes(a.id)) : undefined;
  const selectActor = (value: string) => navigate(value === "all" ? { to: "/threats/$id/network", params: { id: c.id } } : { to: "/threats/$id/network/$actor", params: { id: c.id, actor: value } });
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Waypoints className="size-5 text-muted-foreground" />Peta interaksi</CardTitle>
          <CardDescription>Hubungan antar akun berdasarkan lapisan detektor yang dipilih.</CardDescription>
          <CardAction className="flex flex-wrap justify-end gap-2">
            <Badge variant="outline"><Users className="size-3.5" />{int(members.size)} akun</Badge>
            <Badge variant="outline"><Waypoints className="size-3.5" />{int(edges.length)} hubungan</Badge>
            <Badge variant="outline"><Layers3 className="size-3.5" />{int(c.clusters.length)} cluster</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 @4xl/main:flex-row @4xl/main:items-end">
          <div className="flex flex-col gap-2 @4xl/main:w-64">
            <Label htmlFor="network-actor" className="text-xs text-muted-foreground">Fokus akun</Label>
            <Select value={actor ?? "all"} onValueChange={selectActor}>
              <SelectTrigger id="network-actor" className="w-full">
                <SelectValue placeholder="Cari akun" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua akun</SelectItem>
                {actors.map((item) => <SelectItem key={item.id} value={item.id}>{item.handle ?? short(item.id)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Lapisan bukti</Label>
            <div className="overflow-x-auto">
              <ToggleGroup type="multiple" variant="outline" value={layers} onValueChange={(value) => setLayers(value.length ? value : ALL_LAYERS)} className="justify-start">
                {ALL_LAYERS.map((layer) => <ToggleGroupItem key={layer} value={layer} className="px-3 whitespace-nowrap">{LAYERS[layer] ?? layer}</ToggleGroupItem>)}
              </ToggleGroup>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 @5xl/main:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-xs text-muted-foreground sm:px-6">
              <span>{actor ? "Fokus akun dan tetangganya" : "Semua hubungan dalam cluster kasus"}</span>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Terkoordinasi</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-zinc-500" />Organik</span>
              </div>
            </div>
            <NetworkGraph
              view={state}
              focus={c.clusters}
              layers={layers}
              selected={actor ?? null}
              onSelect={(id) => navigate(id ? { to: "/threats/$id/network/$actor", params: { id: c.id, actor: id } } : { to: "/threats/$id/network", params: { id: c.id } })}
              height="min(70vh, 640px)"
            />
          </CardContent>
        </Card>
        <Card className="min-h-[320px] @5xl/main:min-h-0">
          <CardHeader className="border-b">
            <CardTitle>{a?.handle ?? "Pilih akun"}</CardTitle>
            <CardDescription>{a ? selectedCluster ? `Cluster ${short(selectedCluster.id)}` : "Akun organik" : "Klik node atau cari akun untuk melihat detail"}</CardDescription>
          </CardHeader>
          {a ? (
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Ikatan</span><span className="tabular-nums">{report?.edges.filter((edge) => edge.a === a.id || edge.b === a.id).length ?? 0}</span></div>
                {a.followers !== undefined && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Pengikut</span><span className="tabular-nums">{int(a.followers)}</span></div>}
                {a.createdAt && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Akun dibuat</span><span>{date(a.createdAt)}</span></div>}
                {a.label && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Label simulasi</span><span>{a.label}</span></div>}
              </div>
              <Button variant="outline" className="mt-1" asChild><Link to="/actors/$id" params={{ id: a.id }}>Buka profil aktor</Link></Button>
            </CardContent>
          ) : (
            <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <Waypoints className="size-8" />
              <p className="max-w-56">Pilih node untuk menyorot hubungan dan membuka profil akun.</p>
            </CardContent>
          )}
        </Card>
      </div>
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
