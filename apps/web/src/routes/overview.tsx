import { createRoute, Link } from "@tanstack/react-router";
import { rootRoute } from "@/routes/root";
import { ClusterChips, EmptyState, Panel, Stat, StatRow, Tag, VoiceBar, linkRow } from "@/components/primitives";
import { Counterfactual } from "@/components/counterfactual";
import { ensureView, useViewData } from "@/lib/queries";
import { approx, clock, clusterColor, int, range, ratio, truncate } from "@/lib/format";
import { coordinated, headline, inflation, isCoordinated, profile } from "@/lib/profile";
import type { Narrative, View } from "@/lib/api";
import { cn } from "@/lib/utils";

function Hero({ n }: { n: Narrative }) {
  return (
    <section className="grid gap-10 border-b pb-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="min-w-0">
        <div className="flex items-center gap-3 text-[15px] text-muted-foreground">
          <Tag tone="danger">Coordinated</Tag>
          <Link to="/narratives/$id" params={{ id: n.id }} className="hover:text-foreground">
            Narrative {n.id}
          </Link>
        </div>
        <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1.05]">
          {int(n.supporters)} accounts push it. {approx(n.sie.value)} are independent.
        </h1>
        <p className="mt-4 line-clamp-3 max-w-xl text-[17px] leading-relaxed text-muted-foreground">“{n.sample}”</p>
        <div className="mt-7 max-w-md">
          <VoiceBar apparent={n.supporters} effective={n.sie.value} ci={n.sie.ci} />
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px]">
          <span className="tabular font-medium text-destructive">{ratio(inflation(n))} inflation</span>
          <span className="tabular text-muted-foreground">CI {range(n.sie.ci)}</span>
          <ClusterChips ids={n.clusters} />
        </div>
      </div>
      <div className="min-w-0 self-end">
        <Counterfactual narrative={n} height={280} />
      </div>
    </section>
  );
}

function Calm({ view }: { view: View }) {
  return (
    <section className="border-b pb-10">
      <Tag tone="success">No coordination found</Tag>
      <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1.05]">{int(view.report.narratives.length)} narratives, all carried by independent voices.</h1>
    </section>
  );
}

function Narratives({ view }: { view: View }) {
  const rows = [...view.report.narratives].sort((a, b) => b.supporters - b.sie.value - (a.supporters - a.sie.value)).slice(0, 8);
  return (
    <Panel title="Narratives" action={<Link to="/narratives" className="text-[14px] text-muted-foreground hover:text-foreground">View all</Link>} flush>
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((n) => (
            <li key={n.id}>
              <Link to="/narratives/$id" params={{ id: n.id }} className={cn("grid grid-cols-[48px_minmax(0,1fr)_110px_64px] items-center gap-4 px-5 py-3.5", linkRow)}>
                <span className="text-[14px] font-medium text-muted-foreground">{n.id}</span>
                <span className="truncate text-[15px]">{truncate(n.sample, 120)}</span>
                <VoiceBar apparent={n.supporters} effective={n.sie.value} size="sm" />
                <span className={cn("tabular text-right text-[15px]", isCoordinated(n) ? "font-medium text-destructive" : "text-muted-foreground")}>{ratio(inflation(n))}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-5">
          <EmptyState title="No narratives" />
        </div>
      )}
    </Panel>
  );
}

function Detections({ view }: { view: View }) {
  const rows = [...view.report.clusters].sort((a, b) => a.forensics.onset.ts - b.forensics.onset.ts);
  return (
    <Panel title="Detections" action={<Link to="/clusters" className="text-[14px] text-muted-foreground hover:text-foreground">View all</Link>} flush>
      {rows.length ? (
        <ol className="divide-y">
          {rows.map((c) => (
            <li key={c.id}>
              <Link to="/clusters/$id" params={{ id: c.id }} className={cn("grid grid-cols-[52px_auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5", linkRow)}>
                <span className="tabular text-[15px] text-muted-foreground">{clock(c.forensics.onset.ts)}</span>
                <span className="flex items-center gap-2 text-[15px] font-medium">
                  <span className="size-2.5 rounded-full" style={{ background: clusterColor(c.id) }} />
                  {c.id}
                </span>
                <span className="truncate text-[15px] text-muted-foreground">{profile(c)}</span>
                <span className="tabular text-right text-[15px]">{c.members.length} accounts</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="p-5">
          <EmptyState title="No coordinated clusters" />
        </div>
      )}
    </Panel>
  );
}

function Overview() {
  const view = useViewData();
  const { stats, clusters, narratives } = view.report;
  const top = headline(view);
  const apparent = narratives.reduce((s, n) => s + n.supporters, 0);
  const independent = narratives.reduce((s, n) => s + n.sie.value, 0);
  return (
    <div className="space-y-10">
      {top ? <Hero n={top} /> : <Calm view={view} />}
      <StatRow>
        <Stat label="Accounts" value={int(stats.actors)} sub={`${int(stats.events)} posts`} />
        <Stat label="In coordinated clusters" value={int(stats.flaggedActors)} sub={`${clusters.length} clusters`} tone={stats.flaggedActors ? "danger" : "neutral"} />
        <Stat label="Coordinated narratives" value={coordinated(view).length} sub={`of ${narratives.length}`} />
        <Stat label="Independent voices" value={approx(independent)} sub={`of ${int(apparent)} apparent`} tone="success" />
      </StatRow>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Narratives view={view} />
        <Detections view={view} />
      </div>
    </div>
  );
}

export const overviewRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", staticData: { title: "Overview" }, loader: ensureView, component: Overview });
