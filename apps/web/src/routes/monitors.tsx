import { useState } from "react";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { AtSign, Clapperboard, Hash, MessageSquareText, Music2, Pause, Play, Plus, Send, Trash2, TvMinimalPlay, UserRound } from "lucide-react";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { Section, Summary, Tiles } from "@/components/form-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ensureState, useCapabilities, useCreateMonitor, useCredentials, useDeleteMonitor, useOps, useToggleMonitor } from "@/lib/queries";
import { ago, int, pct } from "@/lib/format";
import type { MonitorKind, MonitorState, Platform } from "@/lib/api";

const KINDS: Record<MonitorKind, { label: string; icon: typeof Hash }> = {
  topic: { label: "Topic", icon: Hash },
  account: { label: "Account", icon: UserRound },
  post: { label: "Post", icon: MessageSquareText },
  simulation: { label: "Demo feed", icon: Clapperboard },
};

const PLATFORMS: Record<Platform, { label: string; kinds: MonitorKind[] }> = {
  x: { label: "X", kinds: ["topic", "account", "post"] },
  youtube: { label: "YouTube", kinds: ["topic", "post"] },
  telegram: { label: "Telegram", kinds: ["account"] },
  tiktok: { label: "TikTok", kinds: ["topic", "post"] },
};

const TARGETS: Record<string, { label: string; placeholder: string }> = {
  "x:topic": { label: "Keywords or hashtag", placeholder: "pulau seruni" },
  "x:account": { label: "Account handle", placeholder: "@tni_ad" },
  "x:post": { label: "Post URL or ID", placeholder: "https://x.com/user/status/123" },
  "youtube:topic": { label: "Search query", placeholder: "pulau seruni" },
  "youtube:post": { label: "Video URL or ID", placeholder: "https://youtu.be/abc123def45" },
  "telegram:account": { label: "Public channels", placeholder: "channel_one, channel_two" },
  "tiktok:topic": { label: "Search query", placeholder: "pulau seruni" },
  "tiktok:post": { label: "Video URL or ID", placeholder: "https://www.tiktok.com/@user/video/123" },
  "demo:simulation": { label: "Scenario seed", placeholder: "1" },
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
          <K.icon className="size-4 text-muted-foreground" />
          <div className="min-w-0">
            <div className="font-medium">{m.label}</div>
            <div className="text-sm text-muted-foreground">{m.kind === "simulation" ? K.label : `${PLATFORMS[m.platform].label} ${K.label.toLowerCase()}`}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {m.lastError ? (
          <Badge variant="destructive">{m.lastError}</Badge>
        ) : m.active ? (
          <Badge variant="secondary">{m.kind === "simulation" && m.progress !== null && m.progress < 1 ? `Running, ${pct(m.progress)}` : "Running"}</Badge>
        ) : (
          <Badge variant="outline">Paused</Badge>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{int(m.collected)}</TableCell>
      <TableCell className="text-muted-foreground">{m.lastRunAt ? ago(m.lastRunAt) : "not yet"}</TableCell>
      <TableCell className="text-muted-foreground">{m.kind === "simulation" ? "every 20 s" : `every ${m.intervalMin} min`}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={m.active ? "Pause" : "Resume"} onClick={() => toggle.mutate({ id: m.id, active: !m.active }, { onError: err })}>
            {m.active ? <Pause /> : <Play />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove.mutate(m.id, { onSuccess: () => toast.success("Monitor deleted"), onError: err })}>
            <Trash2 />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function Monitors() {
  const state = useOps();
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Monitors</h1>
          <p className="text-muted-foreground">What Cakra Nala is watching, and how much it has collected</p>
        </div>
        <Button asChild>
          <Link to="/monitors/new">
            <Plus />
            New monitor
          </Link>
        </Button>
      </div>
      {state.monitors.length ? (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Posts collected</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.monitors.map((m) => (
                <Row key={m.id} m={m} />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Nothing is being watched yet</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/monitors/new">Create the first monitor</Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
      {state.rate.remaining !== null && <p className="text-sm text-muted-foreground">X search budget left in this window: {state.rate.remaining} requests</p>}
    </div>
  );
}

const SOURCES: { id: Platform | "demo"; label: string; icon: typeof Hash }[] = [
  { id: "x", label: "X", icon: AtSign },
  { id: "youtube", label: "YouTube", icon: TvMinimalPlay },
  { id: "telegram", label: "Telegram", icon: Send },
  { id: "tiktok", label: "TikTok", icon: Music2 },
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

function NewMonitor() {
  const caps = useCapabilities();
  const creds = useCredentials();
  const create = useCreateMonitor();
  const navigate = useNavigate();
  const [source, setSource] = useState<Platform | "demo">("x");
  const [picked, setKind] = useState<MonitorKind>("topic");
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("");
  const [interval, setInterval_] = useState("15");
  const [pages, setPages] = useState("3");
  const [speed, setSpeed] = useState("60");
  const kinds = source === "demo" ? (["simulation"] as MonitorKind[]) : PLATFORMS[source].kinds;
  const kind = kinds.includes(picked) ? picked : kinds[0];
  const T = TARGETS[`${source}:${kind}`];
  const live = source !== "demo";
  const ready = (p: Platform) => creds.data?.items.filter((c) => c.platform === p && c.active && !(c.cooldownUntil && c.cooldownUntil > Date.now())).length ?? 0;
  const status = (p: Platform | "demo") => {
    if (p === "demo" || p === "telegram") return { ok: true, text: "No login" };
    if (p === "youtube") return { ok: true, text: ready("youtube") ? `${ready("youtube")} ready` : "No login" };
    if (p === "tiktok" && !caps.data?.tiktok) return { ok: false, text: "Sidecar off" };
    return ready(p) ? { ok: true, text: `${ready(p)} ready` } : { ok: false, text: "No credential" };
  };
  const blocked = !status(source).ok;
  const videos = source === "youtube" || source === "tiktok";
  const runs = Math.round(1440 / Number(interval));
  const submit = () =>
    create.mutate(
      { kind, platform: live ? source : undefined, target: target.trim(), label: label.trim() || undefined, intervalMin: Number(interval), pages: Number(pages), speed: Number(speed) },
      { onSuccess: () => (toast.success("Monitor created"), navigate({ to: "/monitors" })), onError: (e) => toast.error(e.message) },
    );
  const summary: [string, React.ReactNode][] = [
    ["Source", SOURCES.find((x) => x.id === source)!.label],
    ["Type", KINDS[kind].label],
    ["Target", target.trim() ? <span className="font-mono break-all">{target.trim()}</span> : <span className="text-muted-foreground">not set</span>],
    ...(source === "x" && target.trim() ? ([["Query", <span className="font-mono break-all">{xQuery(kind, target)}</span>]] as [string, React.ReactNode][]) : []),
    ...(live
      ? ([
          ["Runs per day", int(runs)],
          [videos ? "Videos per day" : "Requests per day", int(runs * Number(pages))],
          ["Credentials", <Badge variant={status(source).ok ? "secondary" : "destructive"}>{status(source).text}</Badge>],
        ] as [string, React.ReactNode][])
      : ([["Replay", `${Math.round(480 / Number(speed))} minutes`]] as [string, React.ReactNode][])),
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
        <Section step={1} title="Source">
          <Tiles
            value={source}
            onChange={setSource}
            cols="grid-cols-2 @xl/main:grid-cols-5"
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
              <Label htmlFor="label">Name</Label>
              <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Optional" className="h-11" />
            </div>
          </div>
        </Section>
        <Section step={3} title={live ? "Schedule" : "Replay"}>
          {live ? (
            <div className="grid gap-5 @3xl/main:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Collect every</Label>
                <Tiles value={interval} onChange={setInterval_} cols="grid-cols-4" items={["5", "15", "30", "60"].map((v) => ({ id: v, label: `${v} min` }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{videos ? "Videos per run" : "Pages per run"}</Label>
                <Tiles value={pages} onChange={setPages} cols="grid-cols-4" items={["1", "3", "5", "10"].map((v) => ({ id: v, label: v }))} />
              </div>
            </div>
          ) : (
            <Tiles
              value={speed}
              onChange={setSpeed}
              cols="grid-cols-2 @xl/main:grid-cols-4"
              items={[
                { id: "30", label: "16 minutes" },
                { id: "60", label: "8 minutes" },
                { id: "240", label: "2 minutes" },
                { id: "600", label: "Instant" },
              ]}
            />
          )}
        </Section>
      </div>
      <Summary rows={summary}>
        <Button type="submit" className="w-full" disabled={blocked || !target.trim() || create.isPending}>
          {create.isPending ? <Spinner /> : <Play />}
          Start monitoring
        </Button>
        {blocked && (
          <Button type="button" variant="outline" className="w-full" asChild>
            <Link to="/credentials/new">Add credential</Link>
          </Button>
        )}
        <Button type="button" variant="ghost" className="w-full" asChild>
          <Link to="/monitors">Cancel</Link>
        </Button>
      </Summary>
    </form>
  );
}

export const monitorsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/monitors", staticData: { title: "Monitors" }, loader: ensureState, component: Monitors });
export const newMonitorRoute = createRoute({ getParentRoute: () => rootRoute, path: "/monitors/new", staticData: { title: "New monitor" }, component: NewMonitor });
