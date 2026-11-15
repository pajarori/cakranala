import { useState } from "react";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { Clapperboard, FileUp, Hash, LayoutTemplate, MessageSquareText, Pause, Play, Plus, ScanEye, Trash2, UserRound } from "lucide-react";
import { brand, PlatformIcon, type IconComponent } from "@/components/platform-icon";
import { toast } from "sonner";
import { failure } from "@/components/error-dialog";
import { rootRoute } from "@/routes/root";
import { Section, Summary, Tiles } from "@/components/form-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { ensureState, useCapabilities, useCreateMonitor, useCredentials, useDeleteMonitor, useOps, useTemplates, useToggleMonitor } from "@/lib/queries";
import { ago, date, int, num, pct } from "@/lib/format";
import { api, type ImportSummary } from "@/lib/api";
import type { MonitorKind, MonitorState, Platform, Template } from "@/lib/api";

const KINDS: Record<MonitorKind, { label: string; icon: typeof Hash }> = {
  topic: { label: "Topik", icon: Hash },
  account: { label: "Akun", icon: UserRound },
  post: { label: "Post", icon: MessageSquareText },
  simulation: { label: "Demo feed", icon: Clapperboard },
  import: { label: "Impor", icon: FileUp },
};

const PLATFORMS: Record<Platform, { label: string; kinds: MonitorKind[] }> = {
  x: { label: "X", kinds: ["topic", "account", "post"] },
  youtube: { label: "YouTube", kinds: ["topic", "post"] },
  telegram: { label: "Telegram", kinds: ["account"] },
  tiktok: { label: "TikTok", kinds: ["topic", "post"] },
  instagram: { label: "Instagram", kinds: ["topic", "account", "post"] },
  facebook: { label: "Facebook", kinds: ["topic", "account", "post"] },
};

const TARGETS: Record<string, { label: string; placeholder: string }> = {
  "x:topic": { label: "Kata kunci atau hashtag", placeholder: "pulau seruni" },
  "x:account": { label: "Handle akun", placeholder: "@tni_ad" },
  "x:post": { label: "URL atau ID post", placeholder: "https://x.com/user/status/123" },
  "youtube:topic": { label: "Kata pencarian", placeholder: "pulau seruni" },
  "youtube:post": { label: "URL atau ID video", placeholder: "https://youtu.be/abc123def45" },
  "telegram:account": { label: "Kanal publik", placeholder: "kanal_satu, kanal_dua" },
  "tiktok:topic": { label: "Kata pencarian", placeholder: "pulau seruni" },
  "tiktok:post": { label: "URL atau ID video", placeholder: "https://www.tiktok.com/@user/video/123" },
  "instagram:topic": { label: "Tagar", placeholder: "#pulauseruni" },
  "instagram:account": { label: "Nama akun", placeholder: "@tni_angkatan_darat" },
  "instagram:post": { label: "URL post atau reel", placeholder: "https://www.instagram.com/p/AbCdEfGhIjK/" },
  "facebook:topic": { label: "Kata pencarian", placeholder: "pulau seruni" },
  "facebook:account": { label: "URL atau nama Page", placeholder: "https://www.facebook.com/nama.page" },
  "facebook:post": { label: "URL post", placeholder: "https://www.facebook.com/nama.page/posts/123" },
  "demo:simulation": { label: "Seed skenario", placeholder: "1" },
};

function Row({ m }: { m: MonitorState }) {
  const toggle = useToggleMonitor();
  const remove = useDeleteMonitor();
  const K = KINDS[m.kind];
  const err = (e: Error) => toast.error(e.message);
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          {m.kind === "simulation" || m.kind === "import" ? <K.icon className="size-4 text-muted-foreground" /> : <PlatformIcon platform={m.platform} className="text-muted-foreground" />}
          <div className="min-w-0">
            <div className="font-medium">{m.label}</div>
            <div className="text-sm text-muted-foreground">{m.kind === "simulation" ? K.label : `${PLATFORMS[m.platform].label} ${K.label.toLowerCase()}`}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {m.kind === "import" && m.lastError ? (
          <Badge variant="destructive">{m.lastError}</Badge>
        ) : m.kind === "import" && m.importProgress !== null && m.importProgress !== undefined && m.importProgress < 1 ? (
          <div className="flex min-w-48 flex-col gap-1.5">
            <Progress value={m.importProgress * 100} />
            <span className="text-xs text-muted-foreground">{m.note}</span>
          </div>
        ) : m.kind === "import" ? (
          <Badge variant="secondary" title={m.note ?? undefined}>
            {m.note ?? "Diimpor"}
          </Badge>
        ) : m.lastError ? (
          <Badge variant="destructive">{m.lastError}</Badge>
        ) : m.active ? (
          <Badge variant="secondary">{m.kind === "simulation" && m.progress !== null && m.progress < 1 ? `Berjalan, ${pct(m.progress)}` : "Berjalan"}</Badge>
        ) : (
          <Badge variant="outline">Dijeda</Badge>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{int(m.collected)}</TableCell>
      <TableCell className="text-muted-foreground">{m.lastRunAt ? ago(m.lastRunAt) : "belum"}</TableCell>
      <TableCell className="text-muted-foreground">{m.kind === "import" ? "sekali" : m.kind === "simulation" ? "tiap 20 detik" : `tiap ${m.intervalMin} menit`}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {m.kind !== "import" && (
          <Button variant="ghost" size="icon" aria-label={m.active ? "Jeda" : "Lanjutkan"} onClick={() => toggle.mutate({ id: m.id, active: !m.active }, { onError: err })}>
            {m.active ? <Pause /> : <Play />}
          </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Hapus" onClick={() => remove.mutate(m.id, { onSuccess: () => toast.success("Pantauan dihapus"), onError: err })}>
            <Trash2 />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function MonitorTable({ rows }: { rows: MonitorState[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead>Target</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Post terkumpul</TableHead>
            <TableHead>Terakhir jalan</TableHead>
            <TableHead>Jadwal</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => (
            <Row key={m.id} m={m} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Monitors() {
  const state = useOps();
  const [tab, setTab] = useState("all");
  const groups = [
    { id: "all", label: "Semua", rows: state.monitors },
    ...(Object.keys(PLATFORMS) as Platform[]).map((p) => ({ id: p, label: PLATFORMS[p].label, rows: state.monitors.filter((m) => m.kind !== "simulation" && m.kind !== "import" && m.platform === p) })),
    { id: "import", label: "Impor", rows: state.monitors.filter((m) => m.kind === "import") },
    { id: "demo", label: "Demo feed", rows: state.monitors.filter((m) => m.kind === "simulation") },
  ].filter((g) => g.id === "all" || g.rows.length);
  const current = groups.find((g) => g.id === tab) ?? groups[0];
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      {state.monitors.length ? (
        <Tabs value={current.id} onValueChange={setTab} className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              {groups.map((g) => (
                <TabsTrigger key={g.id} value={g.id}>
                  {g.label}
                  <Badge variant="secondary">{g.rows.length}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/monitors/import">
                  <FileUp />
                  Impor data
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/monitors/templates">
                  <LayoutTemplate />
                  Dari template
                </Link>
              </Button>
              <Button asChild>
                <Link to="/monitors/new">
                  <Plus />
                  Pantauan baru
                </Link>
              </Button>
            </div>
          </div>
          <MonitorTable rows={current.rows} />
        </Tabs>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScanEye />
            </EmptyMedia>
            <EmptyTitle>Belum ada yang dipantau</EmptyTitle>
            <EmptyDescription>Mulai dari template topik yang sudah disiapkan, atau buat pantauan sendiri.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center gap-2">
            <Button asChild>
              <Link to="/monitors/templates">Pilih template</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/monitors/new">Buat sendiri</Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
      {state.rate.remaining !== null && <p className="text-sm text-muted-foreground">Sisa kuota pencarian X di jendela ini: {state.rate.remaining} permintaan</p>}
    </div>
  );
}

const SOURCES: { id: Platform | "demo"; label: string; icon: IconComponent }[] = [
  { id: "x", label: "X", icon: brand("x") },
  { id: "youtube", label: "YouTube", icon: brand("youtube") },
  { id: "telegram", label: "Telegram", icon: brand("telegram") },
  { id: "tiktok", label: "TikTok", icon: brand("tiktok") },
  { id: "instagram", label: "Instagram", icon: brand("instagram") },
  { id: "facebook", label: "Facebook", icon: brand("facebook") },
  { id: "demo", label: "Demo feed", icon: Clapperboard },
];

const xQuery = (kind: MonitorKind, t: string) => {
  const v = t.trim();
  if (!v) return "";
  if (kind === "account") {
    const h = v.replace(/^@/, "").replace(/^https?:\/\/(x|twitter)\.com\//, "").split(/[/?]/)[0];
    return `(to:${h} OR @${h})`;
  }
  if (kind === "post") return `conversation ${v.match(/status\/(\d+)/)?.[1] ?? v}`;
  return v;
};

function NewMonitor({ template }: { template?: Template }) {
  const caps = useCapabilities();
  const creds = useCredentials();
  const create = useCreateMonitor();
  const navigate = useNavigate();
  const [source, setSource] = useState<Platform | "demo">((template?.platform as Platform) ?? "x");
  const [picked, setKind] = useState<MonitorKind>((template?.kind as MonitorKind) ?? "topic");
  const [target, setTarget] = useState(template?.target ?? "");
  const [label, setLabel] = useState(template?.title ?? "");
  const [interval, setInterval_] = useState(String(template?.intervalMin ?? 15));
  const [pages, setPages] = useState(String(template?.pages ?? 3));
  const [speed, setSpeed] = useState("60");
  const kinds = source === "demo" ? (["simulation"] as MonitorKind[]) : PLATFORMS[source].kinds;
  const kind = kinds.includes(picked) ? picked : kinds[0];
  const T = TARGETS[`${source}:${kind}`];
  const live = source !== "demo";
  const ready = (p: Platform) => creds.data?.items.filter((c) => c.platform === p && c.active && !(c.cooldownUntil && c.cooldownUntil > Date.now())).length ?? 0;
  const status = (p: Platform | "demo") => {
    if (p === "demo" || p === "telegram") return { ok: true, text: "Tanpa login" };
    if (p === "youtube") return { ok: true, text: ready("youtube") ? `${ready("youtube")} siap` : "Tanpa login" };
    if (p === "tiktok" && !caps.data?.tiktok) return { ok: false, text: "Sidecar mati" };
    if ((p === "instagram" || p === "facebook") && !caps.data?.chrome) return { ok: false, text: "Chrome belum terpasang" };
    return ready(p) ? { ok: true, text: `${ready(p)} siap` } : { ok: false, text: "Belum ada kredensial" };
  };
  const blocked = !status(source).ok;
  const videos = source === "youtube" || source === "tiktok";
  const runs = Math.round(1440 / Number(interval));
  const submit = () =>
    create.mutate(
      { kind, platform: live ? source : undefined, target: target.trim(), label: label.trim() || undefined, intervalMin: Number(interval), pages: Number(pages), speed: Number(speed) },
      { onSuccess: () => (toast.success("Pantauan dibuat"), navigate({ to: "/monitors" })), onError: failure("Pantauan tidak bisa dibuat") },
    );
  const summary: [string, React.ReactNode][] = [
    ["Sumber", SOURCES.find((x) => x.id === source)!.label],
    ["Jenis", KINDS[kind].label],
    ["Target", target.trim() ? <span className="font-mono break-all">{target.trim()}</span> : <span className="text-muted-foreground">belum diisi</span>],
    ...(source === "x" && target.trim() ? ([["Query", <span className="font-mono break-all">{xQuery(kind, target)}</span>]] as [string, React.ReactNode][]) : []),
    ...(live
      ? ([
          ["Pengumpulan per hari", int(runs)],
          [videos ? "Video per hari" : "Permintaan per hari", int(runs * Number(pages))],
          ["Kredensial", <Badge variant={status(source).ok ? "secondary" : "destructive"}>{status(source).text}</Badge>],
        ] as [string, React.ReactNode][])
      : ([["Replay", `${Math.round(480 / Number(speed))} menit`]] as [string, React.ReactNode][])),
  ];
  return (
    <form
      className="grid gap-4 px-4 md:gap-6 lg:px-6 @5xl/main:grid-cols-[minmax(0,1fr)_360px]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex min-w-0 flex-col gap-4 md:gap-6">
        <Section step={1} title="Sumber">
          <Tiles
            value={source}
            onChange={setSource}
            cols={caps.data?.demo ? "grid-cols-2 @3xl/main:grid-cols-4" : "grid-cols-2 @3xl/main:grid-cols-3"}
            items={SOURCES.filter((x) => x.id !== "demo" || caps.data?.demo).map((x) => ({ ...x, badge: <Badge variant={status(x.id).ok ? "secondary" : "outline"}>{status(x.id).text}</Badge> }))}
          />
        </Section>
        <Section step={2} title="Target">
          {kinds.length > 1 && <Tiles value={kind} onChange={setKind} cols={kinds.length === 3 ? "grid-cols-3" : "grid-cols-2"} items={kinds.map((k) => ({ id: k, label: KINDS[k].label, icon: KINDS[k].icon }))} />}
          <div className="grid gap-4 @3xl/main:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="target">{T.label}</Label>
              <Input id="target" required value={target} onChange={(e) => setTarget(e.target.value)} placeholder={T.placeholder} autoComplete="off" spellCheck={false} className="h-11" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="label">Nama</Label>
              <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Opsional" className="h-11" />
            </div>
          </div>
        </Section>
        <Section step={3} title={live ? "Jadwal" : "Replay"}>
          {live ? (
            <div className="grid gap-5 @3xl/main:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Kumpulkan setiap</Label>
                <Tiles value={interval} onChange={setInterval_} cols="grid-cols-4" items={["5", "15", "30", "60"].map((v) => ({ id: v, label: `${v} menit` }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{videos ? "Video per pengumpulan" : "Halaman per pengumpulan"}</Label>
                <Tiles value={pages} onChange={setPages} cols="grid-cols-4" items={["1", "3", "5", "10"].map((v) => ({ id: v, label: v }))} />
              </div>
            </div>
          ) : (
            <Tiles
              value={speed}
              onChange={setSpeed}
              cols="grid-cols-2 @xl/main:grid-cols-4"
              items={[
                { id: "30", label: "16 menit" },
                { id: "60", label: "8 menit" },
                { id: "240", label: "2 menit" },
                { id: "600", label: "Instan" },
              ]}
            />
          )}
        </Section>
      </div>
      <Summary rows={summary}>
        <Button type="submit" className="w-full" disabled={blocked || !target.trim() || create.isPending}>
          {create.isPending ? <Spinner /> : <Play />}
          Mulai memantau
        </Button>
        {blocked && (
          <Button type="button" variant="outline" className="w-full" asChild>
            <Link to="/credentials/new">Tambah kredensial</Link>
          </Button>
        )}
        <Button type="button" variant="ghost" className="w-full" asChild>
          <Link to="/monitors">Batal</Link>
        </Button>
      </Summary>
    </form>
  );
}

function Templates() {
  const { data } = useTemplates();
  const state = useOps();
  const create = useCreateMonitor();
  const navigate = useNavigate();
  const tags = [...new Map((state.report?.narratives ?? []).filter((n) => n.verdict === "manufactured").flatMap((n) => n.tags.map((t) => [t, n.supporters] as const))).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const watching = new Set(state.monitors.map((m) => m.target.toLowerCase()));
  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      {!!tags.length && (
        <Card>
          <CardHeader>
            <CardTitle>Dari tren saat ini</CardTitle>
            <CardDescription>Hashtag yang didorong narasi buatan pada analisis terakhir</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {tags.map(([t, n]) => (
              <Button
                key={t}
                variant="outline"
                size="sm"
                disabled={watching.has(`#${t}`) || create.isPending}
                onClick={() =>
                  create.mutate(
                    { kind: "topic", platform: "x", target: `#${t}`, label: `Tren #${t}`, intervalMin: 15, pages: 3 },
                    { onSuccess: () => (toast.success(`Memantau #${t}`), navigate({ to: "/monitors" })), onError: failure("Pantauan tidak bisa dibuat") },
                  )
                }
              >
                #{t}
                <span className="text-muted-foreground tabular-nums">{n}</span>
                {watching.has(`#${t}`) ? <Badge variant="secondary">Dipantau</Badge> : <Plus />}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
        {(data ?? []).map((t) => {
          const P = SOURCES.find((x) => x.id === t.platform);
          return (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {P && <P.icon className="size-4 text-muted-foreground" />}
                  {t.title}
                </CardTitle>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">{P?.label ?? t.platform}</Badge>
                <Badge variant="outline">{KINDS[t.kind as MonitorKind]?.label ?? t.kind}</Badge>
                <Badge variant="outline">tiap {t.intervalMin} menit</Badge>
                <code className="w-full truncate rounded-md bg-muted px-2 py-1 font-mono text-xs">{t.target}</code>
              </CardContent>
              <CardFooter className="mt-auto">
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/monitors/new/$template" params={{ template: t.id }}>
                    Gunakan template
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FromTemplate() {
  const { template } = newFromTemplateRoute.useParams();
  const { data } = useTemplates();
  const t = data?.find((x) => x.id === template);
  if (!data) return <Spinner className="mx-auto" />;
  return <NewMonitor key={template} template={t} />;
}

function ImportData() {
  const navigate = useNavigate();
  const [file, setFile] = useState<{ name: string; content: string; size: number } | null>(null);
  const [label, setLabel] = useState("");
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveUrl, setArchiveUrl] = useState("");
  const pick = async (f?: File) => {
    if (!f) return;
    setError(null);
    setPreview(null);
    const content = await f.text();
    setFile({ name: f.name, content, size: f.size });
    setBusy(true);
    api
      .previewImport({ name: f.name, content })
      .then(setPreview)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };
  const rows: [string, React.ReactNode][] = file
    ? [
        ["Berkas", <span className="font-mono break-all">{file.name}</span>],
        ["Ukuran", `${num(file.size / 1_000_000)} MB`],
        ...(preview
          ? ([
              ["Post", int(preview.posts)],
              ["Akun", int(preview.accounts)],
              ["Rentang asli", `${date(preview.from)} sampai ${date(preview.to)}`],
              ["Durasi", `${num(preview.spanHours)} jam`],
            ] as [string, React.ReactNode][])
          : []),
      ]
    : [["Berkas", <span className="text-muted-foreground">belum dipilih</span>]];
  const tooLong = !!preview && preview.spanHours > 24;
  return (
    <form
      className="grid gap-4 px-4 md:gap-6 lg:px-6 @5xl/main:grid-cols-[minmax(0,1fr)_360px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!file) return;
        setBusy(true);
        api
          .importData({ name: file.name, label, content: file.content })
          .then((r) => {
            toast.success(`${int(r.added)} post diimpor, analisis berjalan`);
            navigate({ to: "/monitors" });
          })
          .catch((e: Error) => (setError(e.message), failure("Impor gagal")(e)))
          .finally(() => setBusy(false));
      }}
    >
      <div className="flex min-w-0 flex-col gap-4 md:gap-6">
        <Section step={1} title="Berkas">
          <Input type="file" accept=".csv,.json" onChange={(e) => pick(e.target.files?.[0])} className="h-11" />
          <p className="text-sm text-muted-foreground">CSV format arsip transparansi X/Twitter, atau JSON format dataset Cakra Nala. Maksimal 24 jam data; waktunya digeser ke 24 jam terakhir dengan jarak antarpost tetap.</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {tooLong && <p className="text-sm text-destructive">Rentang data lebih dari 24 jam. Potong berkas menjadi maksimal satu hari.</p>}
        </Section>
        <Section step={2} title="Atau arsip besar dari URL">
          <div className="flex flex-col gap-3 @3xl/main:flex-row">
            <Input value={archiveUrl} onChange={(e) => setArchiveUrl(e.target.value)} placeholder="https://.../arsip_tweets.zip" className="h-11" />
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={!archiveUrl.trim() || busy}
              onClick={() => {
                setBusy(true);
                api
                  .importArchive({ url: archiveUrl.trim(), label })
                  .then(() => {
                    toast.success("Arsip sedang diunduh dan dianalisis");
                    navigate({ to: "/monitors" });
                  })
                  .catch((e: Error) => (setError(e.message), failure("Impor arsip gagal")(e)))
                  .finally(() => setBusy(false));
              }}
            >
              <FileUp />
              Impor arsip
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Untuk arsip berukuran besar (ZIP atau CSV format arsip X/Twitter). Waktu asli dipertahankan; Cakra Nala memutar ulang seluruh arsip hari demi hari dan melacak kasus lintas hari.</p>
        </Section>
        <Section step={3} title="Nama">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Opsional, misalnya nama sumber data" className="h-11" />
        </Section>
      </div>
      <Summary title="Ringkasan berkas" rows={rows}>
        <Button type="submit" className="w-full" disabled={!preview || tooLong || busy}>
          {busy ? <Spinner /> : <FileUp />}
          Impor dan analisis
        </Button>
        <Button type="button" variant="ghost" className="w-full" asChild>
          <Link to="/monitors">Batal</Link>
        </Button>
      </Summary>
    </form>
  );
}

export const monitorsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/monitors", staticData: { title: "Monitors" }, loader: ensureState, component: Monitors });
export const newMonitorRoute = createRoute({ getParentRoute: () => rootRoute, path: "/monitors/new", staticData: { title: "New monitor" }, component: () => <NewMonitor /> });
export const newFromTemplateRoute = createRoute({ getParentRoute: () => rootRoute, path: "/monitors/new/$template", staticData: { title: "New monitor" }, component: FromTemplate });
export const importRoute = createRoute({ getParentRoute: () => rootRoute, path: "/monitors/import", staticData: { title: "Import" }, component: ImportData });
export const templatesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/monitors/templates", staticData: { title: "Templates" }, loader: ensureState, component: Templates });
