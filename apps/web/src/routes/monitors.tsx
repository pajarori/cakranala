import { useState } from "react";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { Hash, MessageSquareText, Pause, Play, Plus, Trash2, UserRound, Clapperboard } from "lucide-react";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ensureState, useCapabilities, useCreateMonitor, useDeleteMonitor, useOps, useToggleMonitor } from "@/lib/queries";
import { ago, int, pct } from "@/lib/format";
import type { MonitorKind, MonitorState } from "@/lib/api";

const KINDS: Record<MonitorKind, { label: string; icon: typeof Hash; target: string; placeholder: string; hint: string }> = {
  topic: { label: "Topic", icon: Hash, target: "Keywords or hashtag", placeholder: "e.g. pulau seruni", hint: "Collects every new post that matches the query" },
  account: { label: "Account", icon: UserRound, target: "Account handle", placeholder: "e.g. @tni_ad", hint: "Collects replies and mentions aimed at the account, to catch comment raids" },
  post: { label: "Post", icon: MessageSquareText, target: "Post URL or ID", placeholder: "https://x.com/…/status/…", hint: "Collects every reply to one post" },
  simulation: { label: "Demo feed", icon: Clapperboard, target: "Scenario seed", placeholder: "1", hint: "Replays the fictional Pulau Seruni scenario as if it were live" },
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
            <div className="text-sm text-muted-foreground">{K.label}</div>
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

function NewMonitor() {
  const caps = useCapabilities();
  const create = useCreateMonitor();
  const navigate = useNavigate();
  const [kind, setKind] = useState<MonitorKind>("topic");
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("");
  const [interval, setInterval_] = useState("15");
  const [pages, setPages] = useState("3");
  const [speed, setSpeed] = useState("60");
  const K = KINDS[kind];
  const live = kind !== "simulation";
  const blocked = live && !caps.data?.live;
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <form
        className="max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { kind, target: target.trim(), label: label.trim() || undefined, intervalMin: Number(interval), pages: Number(pages), speed: Number(speed) },
            { onSuccess: () => (toast.success("Monitor created"), navigate({ to: "/monitors" })), onError: (e) => toast.error(e.message) },
          );
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>New monitor</CardTitle>
            <CardDescription>{K.hint}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <ToggleGroup type="single" variant="outline" value={kind} onValueChange={(v) => v && setKind(v as MonitorKind)} className="w-full">
              {(Object.keys(KINDS) as MonitorKind[]).map((k) => {
                const I = KINDS[k].icon;
                return (
                  <ToggleGroupItem key={k} value={k} className="flex-1">
                    <I />
                    {KINDS[k].label}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            <div className="flex flex-col gap-2">
              <Label htmlFor="target">{K.target}</Label>
              <Input id="target" required value={target} onChange={(e) => setTarget(e.target.value)} placeholder={K.placeholder} autoComplete="off" spellCheck={false} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="label">Name</Label>
              <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Optional" />
            </div>
            {live ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Collect every</Label>
                  <Select value={interval} onValueChange={setInterval_}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["5", "15", "30", "60"].map((v) => (
                        <SelectItem key={v} value={v}>
                          {v} minutes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Pages per run</Label>
                  <Select value={pages} onValueChange={setPages}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["1", "3", "5", "10"].map((v) => (
                        <SelectItem key={v} value={v}>
                          {v} pages, about {Number(v) * 20} posts
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label>Replay speed</Label>
                <Select value={speed} onValueChange={setSpeed}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">8 hours in 16 minutes</SelectItem>
                    <SelectItem value="60">8 hours in 8 minutes</SelectItem>
                    <SelectItem value="240">8 hours in 2 minutes</SelectItem>
                    <SelectItem value="600">Almost instant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {blocked && <p className="text-sm text-destructive">Live collection is not configured on this server. Use a demo feed instead.</p>}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/monitors">Cancel</Link>
            </Button>
            <Button type="submit" disabled={blocked || !target.trim() || create.isPending}>
              {create.isPending && <Spinner />}
              Start monitoring
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

export const monitorsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/monitors", staticData: { title: "Monitors" }, loader: ensureState, component: Monitors });
export const newMonitorRoute = createRoute({ getParentRoute: () => rootRoute, path: "/monitors/new", staticData: { title: "New monitor" }, component: NewMonitor });
