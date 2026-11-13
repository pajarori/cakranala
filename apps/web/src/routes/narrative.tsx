import { createRoute, Link } from "@tanstack/react-router";
import { rootRoute } from "@/routes/root";
import { EmptyState, PageHeader, Panel, Stat, StatRow, Tag, VoiceBar, linkRow } from "@/components/primitives";
import { Counterfactual } from "@/components/counterfactual";
import { requireNarrative } from "@/components/use-entity";
import { useViewData } from "@/lib/queries";
import { approx, clock, clusterColor, int, pct, range, ratio } from "@/lib/format";
import { inflation, isCoordinated, profile } from "@/lib/profile";
import { cn } from "@/lib/utils";

function NarrativeDetail() {
  const { id } = narrativeRoute.useParams();
  const view = useViewData();
  const n = view.report.narratives.find((x) => x.id === id);
  if (!n) return <EmptyState title={`Narrative ${id} is not in the current source`} />;
  const flagged = isCoordinated(n);
  return (
    <>
      <PageHeader
        title={`Narrative ${n.id}`}
        meta={
          <>
            {flagged ? <Tag tone="danger">Coordinated</Tag> : <Tag tone="success">Organic</Tag>}
            {n.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </>
        }
      >
        <p className="mt-4 max-w-3xl text-[18px] leading-relaxed text-muted-foreground">“{n.sample}”</p>
      </PageHeader>
      <div className="space-y-6">
        <StatRow>
          <Stat label="Apparent support" value={int(n.supporters)} sub={`${int(n.events)} posts`} />
          <Stat label="Independent voices" value={approx(n.sie.value)} sub={`CI ${range(n.sie.ci)}`} tone="success" hint="Supporters discounted by how dependent they are on each other" />
          <Stat label="Inflation" value={ratio(inflation(n))} tone={flagged ? "danger" : "neutral"} />
          <Stat label="Accounts in clusters" value={int(n.coordinated)} sub={pct(n.coordinated / Math.max(1, n.supporters))} />
        </StatRow>
        <Panel title="Observed against the same narrative without operations">
          <div className="mb-6 max-w-lg">
            <VoiceBar apparent={n.supporters} effective={n.sie.value} ci={n.sie.ci} />
          </div>
          <Counterfactual narrative={n} height={300} />
        </Panel>
        {!!n.clusters.length && (
          <Panel title="Driven by" flush>
            <ul className="divide-y">
              {n.clusters.map((ref) => {
                const c = view.report.clusters.find((x) => x.id === ref.id);
                if (!c) return null;
                return (
                  <li key={c.id}>
                    <Link to="/clusters/$id" params={{ id: c.id }} className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 px-5 py-4", linkRow)}>
                      <span className="flex items-center gap-2.5 text-[16px] font-medium">
                        <span className="size-2.5 rounded-full" style={{ background: clusterColor(c.id) }} />
                        {c.id}
                      </span>
                      <span className="min-w-0">
                        <span className="text-[15px]">{profile(c)}</span>
                        <span className="mt-0.5 block truncate text-[14px] text-muted-foreground">{c.brief ?? c.forensics.talkingPoints[0]}</span>
                      </span>
                      <span className="tabular text-right text-[15px] text-muted-foreground">
                        {ref.actors} accounts here, started {clock(c.forensics.onset.ts)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}

export const narrativeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/narratives/$id",
  staticData: { title: "Narratives" },
  loader: ({ params }) => requireNarrative(params.id),
  component: NarrativeDetail,
});
