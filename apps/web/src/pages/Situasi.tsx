import { LineChart } from "@/components/ui/line-chart";
import { Badge } from "@/components/ui/badge";
import { Empty, Metric, Panel } from "@/components/kit";
import { fmt, pct, time, type View } from "@/lib/api";

export function Situasi({ view, onCluster }: { view: View; onCluster: (id: string) => void }) {
  const { report, evaluation } = view;
  const top = report.narratives.filter((n) => n.clusters.length).slice(0, 4);
  const rest = report.narratives.filter((n) => !n.clusters.length).slice(0, 3);
  return (
    <div className="space-y-5">
      <Panel>
        <div className="grid grid-cols-2 gap-5 md:grid-cols-5">
          <Metric label="Accounts" value={fmt.format(report.stats.actors)} hint={`${fmt.format(report.stats.events)} posts`} />
          <Metric label="Coordinated accounts" value={fmt.format(report.stats.flaggedActors)} tone={report.stats.flaggedActors ? "danger" : "success"} hint={pct(report.stats.flaggedActors / Math.max(1, report.stats.actors))} />
          <Metric label="Clusters" value={report.clusters.length} hint={`${report.edges.length} significant ties`} />
          <Metric label="Evidence layers" value={report.stats.layersRun.length} hint={view.source.coverage !== undefined ? `coverage ${pct(view.source.coverage)}` : undefined} />
          {evaluation ? (
            <Metric label="vs ground truth" value={`P ${pct(evaluation.precision)} · R ${pct(evaluation.recall)}`} hint={`viral FP ${pct(evaluation.viralFlagRate ?? 0)}`} tone="success" />
          ) : (
            <Metric label="Mode" value="Live" />
          )}
        </div>
      </Panel>

      {!top.length && <Empty>No coordinated narratives.</Empty>}

      {top.map((n) => {
        const amplification = n.supporters / Math.max(1, n.sie.value);
        const data = n.counterfactual.all.map((v, i) => ({ t: time(n.counterfactual.start + i * n.counterfactual.binSec * 1000), semua: v, organik: n.counterfactual.organic[i] }));
        return (
          <Panel
            key={n.id}
            title={`Narrative ${n.id}`}
            action={
              <div className="flex gap-1.5">
                {n.tags.slice(0, 3).map((t) => (
                  <Badge key={t} size="sm">
                    #{t}
                  </Badge>
                ))}
              </div>
            }
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className="space-y-4">
                <blockquote className="border-l-2 border-line-2 pl-3 text-[13.5px] leading-relaxed text-fg-2">“{n.sample}”</blockquote>
                <div className="grid grid-cols-3 gap-4">
                  <Metric label="Apparent support" value={`${fmt.format(n.supporters)} accounts`} />
                  <Metric label="Effective voices (SIE)" value={`±${fmt.format(n.sie.value)}`} hint={`95%: ${fmt.format(n.sie.ci[0])}–${fmt.format(n.sie.ci[1])}`} tone="warning" />
                  <Metric label="Inflation" value={`×${fmt.format(amplification)}`} tone={amplification > 2 ? "danger" : undefined} hint={`IKS ${pct(n.iks)}`} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-fg-3">
                  {n.clusters.map((c) => (
                    <button key={c.id} onClick={() => onCluster(c.id)} className="rounded-md border border-line-2 px-1.5 py-0.5 text-fg-2 hover:bg-hover hover:text-fg">
                      {c.id} · {c.actors}
                    </button>
                  ))}
                </div>
              </div>
              <LineChart
                data={data}
                xKey="t"
                label={`${n.id} volume`}
                series={[
                  { key: "semua", label: "Observed" },
                  { key: "organik", label: "Without operations", variant: "dashed" },
                ]}
                height={190}
                area
                zero
              />
            </div>
          </Panel>
        );
      })}

      {!!rest.length && (
        <Panel title="Organic narratives">
          <div className="grid gap-3 md:grid-cols-3">
            {rest.map((n) => (
              <div key={n.id} className="rounded-lg border border-line p-3">
                <div className="line-clamp-2 text-[12.5px] text-fg-2">“{n.sample}”</div>
                <div className="mt-2 text-[12px] text-fg-3">
                  {fmt.format(n.supporters)} accounts · SIE ±{fmt.format(n.sie.value)}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
