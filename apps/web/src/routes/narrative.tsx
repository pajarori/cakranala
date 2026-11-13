import { Link, useParams } from "@tanstack/react-router";
import { Card, EmptyState, PageHeader, Pill, Stat, StatRow, VoiceBar } from "@/components/primitives";
import { Counterfactual } from "@/components/counterfactual";
import { ViewGate } from "@/components/view-gate";
import { clock, clusterColor, int, num, pct, ratio } from "@/lib/format";
import { inflation, profile } from "@/lib/profile";
import type { View } from "@/lib/api";

function Body({ view, id }: { view: View; id: string }) {
  const n = view.report.narratives.find((x) => x.id === id);
  if (!n) return <EmptyState title={`Narrative ${id} is not in the current source.`} action={<Link to="/narratives" className="text-[13px] text-fg-2 underline">Back to narratives</Link>} />;
  const coordinated = n.clusters.reduce((s, c) => s + c.actors, 0);
  const manufactured = n.clusters.length > 0;
  return (
    <>
      <PageHeader
        title={n.id}
        eyebrow={
          <>
            {manufactured ? <Pill tone="danger">Manufactured</Pill> : <Pill tone="success">Organic</Pill>}
            {n.tags.map((t) => (
              <span key={t} className="text-fg-3">
                #{t}
              </span>
            ))}
          </>
        }
      >
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-fg-2">“{n.sample}”</p>
      </PageHeader>
      <div className="space-y-5">
        <StatRow>
          <Stat label="Apparent support" value={int(n.supporters)} sub={`${int(n.events)} posts`} />
          <Stat label="Independent voices" value={`±${num(n.sie.value)}`} sub={`95% CI ${num(n.sie.ci[0])}–${num(n.sie.ci[1])}`} tone="success" title="Effective independent voices (SIE): supporters discounted by how dependent they are on each other" />
          <Stat label="Inflation" value={ratio(inflation(n))} tone={manufactured ? "danger" : undefined} />
          <Stat label="Coordinated accounts" value={int(coordinated)} sub={pct(coordinated / Math.max(1, n.supporters))} />
        </StatRow>
        <Card title="Voices">
          <VoiceBar apparent={n.supporters} effective={n.sie.value} ci={n.sie.ci} />
        </Card>
        <Card title="Observed vs without operations">
          <Counterfactual narrative={n} height={280} />
        </Card>
        {manufactured && (
          <Card title="Driven by" flush>
            <ul className="divide-y divide-line">
              {n.clusters.map((ref) => {
                const c = view.report.clusters.find((x) => x.id === ref.id);
                if (!c) return null;
                const p = profile(c);
                return (
                  <li key={c.id}>
                    <Link to="/clusters/$id" params={{ id: c.id }} className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-hover">
                      <span className="size-2.5 rounded-full" style={{ background: clusterColor(c.id) }} />
                      <span className="text-fg">{c.id}</span>
                      <span className="flex items-center gap-2">
                        <Pill tone={p.tone}>{p.label}</Pill>
                        <span className="truncate text-[12.5px] text-fg-3">{c.brief ?? c.forensics.talkingPoints[0]}</span>
                      </span>
                      <span className="tabular text-right text-[12.5px] text-fg-3">
                        {ref.actors} here · ρ {c.rho.toFixed(2)} · T0 {clock(c.forensics.onset.ts)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

export function NarrativeDetail() {
  const { id } = useParams({ strict: false }) as { id: string };
  return <ViewGate>{(view) => <Body view={view} id={id} />}</ViewGate>;
}
