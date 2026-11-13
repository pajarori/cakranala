import { useState } from "react";
import { AsyncButton } from "@/components/ui/async-button";
import { useToast } from "@/components/ui/toast";
import { Card, ErrorState, KeyValue, PageHeader, Pill } from "@/components/primitives";
import { useCapabilities, useLive, useLoadSnapshot, useSimulate, useSnapshots, useView } from "@/lib/queries";
import { date, int, pct } from "@/lib/format";

const input = "h-9 w-full rounded-md border border-line-2 bg-page px-3 text-[16px] text-fg outline-none placeholder:text-fg-4 focus:border-fg-3 sm:text-[13.5px]";

const stored = (k: string) => {
  try {
    return sessionStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
};

function Active() {
  const { data } = useView();
  if (!data) return null;
  const s = data.source;
  return (
    <Card title="Active source">
      <KeyValue
        items={[
          ["Type", s.kind === "sim" ? <Pill tone="warning">Simulation</Pill> : <Pill tone="info">Live, pseudonymized</Pill>],
          ["Source", s.label],
          ["Accounts", int(data.report.stats.actors)],
          ["Posts", int(data.report.stats.events)],
          ["Coverage", pct(s.coverage ?? 1)],
          ...(s.collectedAt ? ([["Collected", date(s.collectedAt)]] as [string, string][]) : []),
        ]}
      />
    </Card>
  );
}

function Simulation() {
  const [seed, setSeed] = useState(1);
  const simulate = useSimulate();
  const toast = useToast();
  return (
    <Card title="Simulation">
      <label className="block text-[12.5px] text-fg-3" htmlFor="seed">
        Seed
      </label>
      <div className="mt-1.5 flex gap-2">
        <input id="seed" type="number" min={1} inputMode="numeric" value={seed} onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))} className={input} />
        <AsyncButton pendingLabel="Analyzing…" onClick={() => simulate.mutateAsync(seed).then(() => toast.add({ title: `Simulation seed ${seed} loaded`, tone: "success" }))}>
          Run
        </AsyncButton>
      </div>
      {simulate.error && <div className="mt-3"><ErrorState error={simulate.error} /></div>}
    </Card>
  );
}

function Live() {
  const caps = useCapabilities();
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState(5);
  const [token, setToken] = useState(() => stored("operator"));
  const live = useLive();
  const toast = useToast();
  const disabled = !caps.data?.live;
  const submit = () => {
    try {
      sessionStorage.setItem("operator", token);
    } catch {}
    return live.mutateAsync({ query: query.trim(), pages, token }).then((v) => toast.add({ title: `Collected ${int(v.report.stats.events)} posts`, tone: "success" }));
  };
  return (
    <Card title="Live collection · X" action={disabled ? <Pill>Not configured</Pill> : undefined}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim() && token) submit();
        }}
      >
        <div>
          <label className="block text-[12.5px] text-fg-3" htmlFor="query">
            Query
          </label>
          <input id="query" name="query" autoComplete="off" spellCheck={false} disabled={disabled} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. gibran…" className={`${input} mt-1.5`} />
        </div>
        <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
          <div>
            <label className="block text-[12.5px] text-fg-3" htmlFor="pages">
              Pages
            </label>
            <select id="pages" disabled={disabled} value={pages} onChange={(e) => setPages(Number(e.target.value))} className={`${input} mt-1.5 bg-page text-fg`}>
              {[3, 5, 10, 15].map((p) => (
                <option key={p} value={p}>
                  {p} · ~{p * 20}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12.5px] text-fg-3" htmlFor="token">
              Operator token
            </label>
            <input id="token" name="token" type="password" autoComplete="current-password" disabled={disabled} value={token} onChange={(e) => setToken(e.target.value)} className={`${input} mt-1.5`} />
          </div>
        </div>
        <div className="flex justify-end">
          <AsyncButton type="submit" disabled={disabled || !query.trim() || !token} pendingLabel="Collecting…" onClick={submit}>
            Collect
          </AsyncButton>
        </div>
      </form>
      {live.error && <div className="mt-3"><ErrorState error={live.error} /></div>}
    </Card>
  );
}

function Snapshots() {
  const { data, error } = useSnapshots();
  const load = useLoadSnapshot();
  const toast = useToast();
  return (
    <Card title="Snapshots" flush>
      {error ? (
        <div className="p-4"><ErrorState error={error} /></div>
      ) : !data?.length ? (
        <div className="px-4 py-8 text-center text-[13px] text-fg-4">No snapshots yet</div>
      ) : (
        <ul className="divide-y divide-line">
          {data.map((s) => (
            <li key={s.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] text-fg">{s.source.label}</div>
                <div className="tabular text-[12px] text-fg-3">
                  {date(Number(s.id))} · {int(s.events)} posts
                </div>
              </div>
              <AsyncButton size="sm" variant="secondary" pendingLabel="Loading…" onClick={() => load.mutateAsync(s.id).then(() => toast.add({ title: "Snapshot loaded", tone: "success" }))}>
                Load
              </AsyncButton>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function Sources() {
  return (
    <>
      <PageHeader title="Sources" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Active />
          <Simulation />
        </div>
        <div className="space-y-5">
          <Live />
          <Snapshots />
        </div>
      </div>
    </>
  );
}
