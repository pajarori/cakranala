import { SortableTable } from "@/components/ui/sortable-table";
import { Empty, Metric, Panel } from "@/components/kit";
import { LAYER_NAMES, fmt, time, type View } from "@/lib/api";

type Evidence = View["report"]["clusters"][number]["layers"][number];

export function Dosir({ view, focus, onFocus }: { view: View; focus: string | null; onFocus: (id: string) => void }) {
  const { report } = view;
  if (!report.clusters.length) return <Empty>No coordinated clusters.</Empty>;
  const c = report.clusters.find((x) => x.id === focus) ?? report.clusters[0];
  const f = c.forensics;
  const handle = (id: string) => view.actors.find((a) => a.id === id)?.handle ?? id;
  const rotation = f.rotation === null ? "—" : f.rotation.toFixed(2);
  const scripted = (f.rotation ?? 0) > 0.7;
  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Panel title="Clusters">
        <div className="space-y-1">
          {report.clusters.map((x) => (
            <button key={x.id} onClick={() => onFocus(x.id)} className={`flex w-full justify-between rounded-md px-2 py-1.5 text-[13px] ${x.id === c.id ? "bg-raised text-fg" : "text-fg-2 hover:bg-hover"}`}>
              <span>{x.id}</span>
              <span className="tabular text-fg-3">{x.members.length}</span>
            </button>
          ))}
        </div>
      </Panel>
      <div className="min-w-0 space-y-5">
        <Panel title={`Dossier ${c.id}`}>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            <Metric label="Members" value={c.members.length} />
            <Metric label="Dependence ρ" value={c.rho.toFixed(2)} />
            <Metric label="Waves" value={f.waves} />
            <Metric label="T0" value={time(f.onset.ts)} hint={`${f.onset.actors} accounts / ${f.onset.windowSec / 60} min`} tone="warning" />
          </div>
        </Panel>

        {c.brief && (
          <Panel title="Reconstructed brief">
            <p className="text-[14px] leading-relaxed text-fg">{c.brief}</p>
          </Panel>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <Panel title="Tooling fingerprint">
            <div className="grid grid-cols-2 gap-4">
              <Metric label="Rotation τ" value={rotation} tone={scripted ? "danger" : undefined} hint={scripted ? "scripted order" : undefined} />
              <Metric label="Cadence" value={f.cadence ? `${fmt.format(f.cadence.medianSec)}s` : "—"} hint={f.cadence ? `CV ${f.cadence.cv.toFixed(2)}` : undefined} />
            </div>
          </Panel>
          <Panel title="Seeders">
            {f.seeders.length ? (
              <ol className="space-y-1.5 text-[13px]">
                {f.seeders.map((s) => (
                  <li key={s.actor} className="flex justify-between">
                    <span className="font-mono text-fg-2">{handle(s.actor)}</span>
                    <span className="tabular text-fg-3">lead {Math.round(s.leadScore * 100)}%</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-fg-3">—</div>
            )}
          </Panel>
        </div>

        <Panel title="Talking points">
          <ul className="space-y-2">
            {f.talkingPoints.map((t) => (
              <li key={t} className="border-l-2 border-line-2 pl-3 text-[13px] text-fg-2">
                {t}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Evidence">
          <SortableTable<Evidence>
            caption="Evidence"
            getRowId={(r) => r.layer}
            rows={c.layers}
            defaultSort={{ column: "ratio", direction: "desc" }}
            columns={[
              { key: "layer", header: "Layer", cell: (r) => LAYER_NAMES[r.layer] ?? r.layer, sortValue: (r) => r.layer },
              { key: "pairs", header: "Pairs", numeric: true, sortValue: (r) => r.pairs },
              { key: "obs", header: "Observed", numeric: true, cell: (r) => fmt.format(r.meanObserved), sortValue: (r) => r.meanObserved },
              { key: "exp", header: "Expected", numeric: true, cell: (r) => fmt.format(r.meanExpected), sortValue: (r) => r.meanExpected },
              { key: "ratio", header: "Ratio", numeric: true, cell: (r) => `×${fmt.format(r.meanObserved / Math.max(r.meanExpected, 0.01))}`, sortValue: (r) => r.meanObserved / Math.max(r.meanExpected, 0.01) },
              { key: "ep", header: "Waves", numeric: true, cell: (r) => fmt.format(r.meanEpisodes), sortValue: (r) => r.meanEpisodes },
            ]}
          />
        </Panel>

        <Panel title="Members">
          <div className="flex flex-wrap gap-1.5">
            {c.members.map((m) => (
              <span key={m} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11.5px] text-fg-3">
                {handle(m)}
              </span>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
