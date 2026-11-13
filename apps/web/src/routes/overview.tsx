import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Card, ClusterChip, Pill, PageHeader, Stat, StatRow, VoiceBar } from "@/components/primitives";
import { Counterfactual } from "@/components/counterfactual";
import { ViewGate } from "@/components/view-gate";
import { clock, clusterColor, int, num, pct, ratio, truncate } from "@/lib/format";
import { inflation, manufactured, profile } from "@/lib/profile";
import type { View } from "@/lib/api";

function Verdict({ view }: { view: View }) {
  const top = [...manufactured(view)].sort((a, b) => inflation(b) - inflation(a))[0];
  if (!top)
    return (
      <Card>
        <div className="flex items-center gap-3">
          <Pill tone="success">Organic</Pill>
          <span className="text-fg-2">No narrative in this source shows coordinated amplification.</span>
        </div>
      </Card>
    );
  return (
    <Link to="/narratives/$id" params={{ id: top.id }} className="group block rounded-lg border border-danger/25 bg-frame transition-colors hover:border-danger/50">
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Pill tone="danger">Manufactured</Pill>
            <span className="text-[12.5px] text-fg-3">{top.id}</span>
            <ArrowUpRight size={14} className="ml-auto text-fg-4 transition-colors group-hover:text-fg-2 lg:hidden" />
          </div>
          <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed text-fg">“{top.sample}”</p>
        </div>
        <div>
          <div className="mb-3 grid grid-cols-3 gap-4">
            <Stat label="Apparent" value={int(top.supporters)} />
            <Stat label="Independent" value={`±${num(top.sie.value)}`} tone="success" />
            <Stat label="Inflation" value={ratio(inflation(top))} tone="danger" />
          </div>
          <VoiceBar apparent={top.supporters} effective={top.sie.value} ci={top.sie.ci} />
        </div>
      </div>
    </Link>
  );
}

function NarrativeRows({ view }: { view: View }) {
  const rows = [...view.report.narratives].sort((a, b) => b.supporters - b.sie.value - (a.supporters - a.sie.value)).slice(0, 7);
  return (
    <Card title="Narratives" action={<Link to="/narratives" className="text-[12px] text-fg-3 hover:text-fg">All</Link>} flush>
      <ul className="divide-y divide-line">
        {rows.map((n) => (
          <li key={n.id}>
            <Link to="/narratives/$id" params={{ id: n.id }} className="grid grid-cols-[44px_minmax(0,1fr)_120px_64px] items-center gap-4 px-4 py-3 transition-colors hover:bg-hover">
              <span className="font-mono text-[12px] text-fg-3">{n.id}</span>
              <span className="truncate text-[13px] text-fg-2">{truncate(n.sample, 110)}</span>
              <VoiceBar apparent={n.supporters} effective={n.sie.value} size="sm" />
              <span className={`tabular text-right text-[13px] ${n.clusters.length ? "text-danger" : "text-fg-3"}`}>{ratio(inflation(n))}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Detections({ view }: { view: View }) {
  const rows = [...view.report.clusters].sort((a, b) => a.forensics.onset.ts - b.forensics.onset.ts);
  return (
    <Card title="Detections" action={<Link to="/clusters" className="text-[12px] text-fg-3 hover:text-fg">All</Link>} flush>
      {rows.length ? (
        <ol className="divide-y divide-line">
          {rows.map((c) => {
            const p = profile(c);
            return (
              <li key={c.id}>
                <Link to="/clusters/$id" params={{ id: c.id }} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-hover">
                  <span className="tabular w-11 text-[12.5px] text-fg-3">{clock(c.forensics.onset.ts)}</span>
                  <span className="size-2 rounded-full" style={{ background: clusterColor(c.id) }} />
                  <span className="text-[13px] text-fg">{c.id}</span>
                  <Pill tone={p.tone}>{p.label}</Pill>
                  <span className="tabular ml-auto text-[12.5px] text-fg-3">
                    {c.members.length} accounts · {c.forensics.waves} waves
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="px-4 py-10 text-center text-fg-3">None</div>
      )}
    </Card>
  );
}

function Control({ view }: { view: View }) {
  const organic = view.report.narratives.filter((n) => !n.clusters.length).sort((a, b) => b.supporters - a.supporters).slice(0, 3);
  if (!organic.length) return null;
  return (
    <Card title="Organic control" flush>
      <ul className="divide-y divide-line">
        {organic.map((n) => (
          <li key={n.id} className="grid grid-cols-[44px_minmax(0,1fr)_140px] items-center gap-4 px-4 py-3">
            <span className="font-mono text-[12px] text-fg-3">{n.id}</span>
            <span className="truncate text-[13px] text-fg-2">{n.sample}</span>
            <span className="tabular text-right text-[12.5px] text-fg-3">
              {int(n.supporters)} → ±{num(n.sie.value)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Body({ view }: { view: View }) {
  const { stats, clusters } = view.report;
  const top = [...manufactured(view)].sort((a, b) => inflation(b) - inflation(a))[0];
  const e = view.evaluation;
  return (
    <>
      <PageHeader title="Overview" eyebrow={view.source.label} />
      <div className="space-y-5">
        <Verdict view={view} />
        <StatRow>
          <Stat label="Accounts" value={int(stats.actors)} sub={`${int(stats.events)} posts`} />
          <Stat label="Coordinated" value={int(stats.flaggedActors)} sub={pct(stats.flaggedActors / Math.max(1, stats.actors))} tone={stats.flaggedActors ? "danger" : undefined} />
          <Stat label="Clusters" value={clusters.length} sub={`${int(view.report.edges.length)} ties`} />
          <Stat label="Manufactured narratives" value={manufactured(view).length} sub={`of ${view.report.narratives.length}`} />
          {e ? <Stat label="Precision" value={pct(e.precision)} sub={`recall ${pct(e.recall)}`} /> : <Stat label="Coverage" value={pct(view.source.coverage ?? 1)} />}
        </StatRow>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <NarrativeRows view={view} />
          <Detections view={view} />
        </div>
        {top && (
          <Card
            title={`${top.id} · observed vs without operations`}
            action={
              <div className="flex gap-1.5">
                {top.clusters.map((c) => (
                  <ClusterChip key={c.id} id={c.id} color={clusterColor(c.id)} count={c.actors} />
                ))}
              </div>
            }
          >
            <Counterfactual narrative={top} />
          </Card>
        )}
        <Control view={view} />
      </div>
    </>
  );
}

export function Overview() {
  return <ViewGate>{(view) => <Body view={view} />}</ViewGate>;
}
