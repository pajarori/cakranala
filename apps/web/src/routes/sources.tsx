import { useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { ErrorState, KeyValue, PageHeader, Panel, Tag } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCapabilities, useLive, useLoadSnapshot, useSimulate, useSnapshots, useView } from "@/lib/queries";
import { date, int, pct } from "@/lib/format";

const field = "h-10 text-[16px]";

function Active() {
  const { data } = useView();
  if (!data) return null;
  const s = data.source;
  return (
    <Panel title="Active source">
      <KeyValue
        items={[
          ["Type", s.kind === "sim" ? <Tag tone="warning">Simulation</Tag> : <Tag>Live, pseudonymized</Tag>],
          ["Source", s.label],
          ["Accounts", int(data.report.stats.actors)],
          ["Posts", int(data.report.stats.events)],
          ["Coverage", pct(s.coverage ?? 1)],
          ...(s.collectedAt ? ([["Collected", date(s.collectedAt)]] as [string, string][]) : []),
        ]}
      />
    </Panel>
  );
}

function Simulation() {
  const [seed, setSeed] = useState("1");
  const simulate = useSimulate();
  const value = Math.max(1, Math.floor(Number(seed)) || 1);
  return (
    <Panel title="Simulation">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          simulate.mutate(value, { onSuccess: () => toast.success(`Simulation ${value} loaded`) });
        }}
      >
        <Label htmlFor="seed" className="text-[15px]">
          Scenario seed
        </Label>
        <div className="mt-2 flex gap-3">
          <Input id="seed" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ""))} className={field} />
          <Button type="submit" disabled={simulate.isPending} className="h-10 px-5 text-[15px]">
            {simulate.isPending && <Loader2 className="animate-spin" />}
            Run
          </Button>
        </div>
      </form>
      {simulate.error && <div className="mt-4"><ErrorState error={simulate.error} title="Run failed" /></div>}
    </Panel>
  );
}

function Live() {
  const caps = useCapabilities();
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState("5");
  const [token, setToken] = useState("");
  const live = useLive();
  const disabled = !caps.data?.live;
  return (
    <Panel title="Live collection on X" action={disabled ? <Tag>Not configured</Tag> : undefined}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!query.trim() || !token) return;
          live.mutate({ query: query.trim(), pages: Number(pages), token }, { onSuccess: (v) => toast.success(`Collected ${int(v.report.stats.events)} posts`) });
        }}
      >
        <div>
          <Label htmlFor="query" className="text-[15px]">
            Search query
          </Label>
          <Input id="query" name="query" autoComplete="off" spellCheck={false} disabled={disabled} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. gibran…" className={`${field} mt-2`} />
        </div>
        <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
          <div>
            <Label htmlFor="pages" className="text-[15px]">
              Pages
            </Label>
            <Select value={pages} onValueChange={setPages} disabled={disabled}>
              <SelectTrigger id="pages" className="mt-2 h-10 w-full text-[15px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["3", "5", "10", "15"].map((p) => (
                  <SelectItem key={p} value={p} className="text-[15px]">
                    {p} pages, about {Number(p) * 20} posts
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="token" className="text-[15px]">
              Operator token
            </Label>
            <Input id="token" name="token" type="password" autoComplete="off" disabled={disabled} value={token} onChange={(e) => setToken(e.target.value)} className={`${field} mt-2`} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={disabled || !query.trim() || !token || live.isPending} className="h-10 px-5 text-[15px]">
            {live.isPending && <Loader2 className="animate-spin" />}
            Collect and analyze
          </Button>
        </div>
      </form>
      {live.error && <div className="mt-4"><ErrorState error={live.error} title="Collection failed" /></div>}
    </Panel>
  );
}

function Snapshots() {
  const { data, error } = useSnapshots();
  const load = useLoadSnapshot();
  return (
    <Panel title="Snapshots" flush>
      {error ? (
        <div className="p-5"><ErrorState error={error} /></div>
      ) : !data?.length ? (
        <div className="px-5 py-10 text-center text-[15px] text-muted-foreground">No snapshots yet</div>
      ) : (
        <ul className="divide-y">
          {data.map((s) => (
            <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px]">{s.source.label}</div>
                <div className="tabular text-[14px] text-muted-foreground">
                  {date(Number(s.id))}, {int(s.events)} posts
                </div>
              </div>
              <Button variant="outline" disabled={load.isPending} onClick={() => load.mutate(s.id, { onSuccess: () => toast.success("Snapshot loaded") })} className="text-[15px]">
                {load.isPending && load.variables === s.id && <Loader2 className="animate-spin" />}
                Load
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Sources() {
  return (
    <>
      <PageHeader title="Sources" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Active />
          <Simulation />
        </div>
        <div className="space-y-6">
          <Live />
          <Snapshots />
        </div>
      </div>
    </>
  );
}

export const sourcesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/sources", staticData: { title: "Sources" }, component: Sources });
