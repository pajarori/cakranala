import { useState, type ReactNode } from "react";
import { Link, Outlet, useMatches, useNavigate, useParams } from "@tanstack/react-router";
import { Boxes, ChevronRight, Database, FlaskConical, LayoutDashboard, Menu, MessagesSquare, Radar, ShieldCheck, Waypoints } from "lucide-react";
import { CommandPalette, CommandPaletteTrigger, type CommandGroup } from "@/components/ui/command-palette";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/toast";
import { useView } from "@/lib/queries";
import { manufactured } from "@/lib/profile";
import { int, truncate } from "@/lib/format";
import { cn } from "@/lib/cn";

const NAV = [
  { group: "Intelligence", items: [
    { to: "/", label: "Overview", icon: LayoutDashboard },
    { to: "/narratives", label: "Narratives", icon: MessagesSquare, count: "narratives" },
    { to: "/clusters", label: "Clusters", icon: Boxes, count: "clusters" },
    { to: "/network", label: "Network", icon: Waypoints },
  ] },
  { group: "Protection", items: [{ to: "/perisai", label: "Perisai", icon: ShieldCheck }] },
  { group: "System", items: [
    { to: "/evaluation", label: "Evaluation", icon: FlaskConical },
    { to: "/sources", label: "Sources", icon: Database },
  ] },
] as const;

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-2">
      <span className="grid size-7 place-items-center rounded-lg bg-fg text-page">
        <Radar size={16} strokeWidth={2} />
      </span>
      <span className="font-display text-[16px] font-semibold">Cakra Nala</span>
    </Link>
  );
}

function SourceCard() {
  const { data } = useView();
  if (!data) return null;
  const live = data.source.kind === "x";
  return (
    <Link to="/sources" className="block rounded-lg border border-line bg-raised p-3 transition-colors hover:border-line-2">
      <div className="flex items-center gap-1.5 text-[12px] font-medium">
        <span className={cn("size-1.5 rounded-full", live ? "bg-info" : "bg-warning")} />
        <span className={live ? "text-info" : "text-warning"}>{live ? "Live data, pseudonymized" : "Simulation"}</span>
      </div>
      <div className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-fg-2">{data.source.label}</div>
      <div className="tabular mt-1 text-[11px] text-fg-3">
        {int(data.report.stats.actors)} accounts · {int(data.report.stats.events)} posts
      </div>
    </Link>
  );
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useView();
  const counts = { narratives: data ? manufactured(data).length : undefined, clusters: data?.report.clusters.length };
  return (
    <nav className="flex flex-col gap-5">
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="mb-1 px-2 text-[11px] font-medium text-fg-4">{g.group}</div>
          <div className="flex flex-col gap-px">
            {g.items.map((item) => {
              const Icon = item.icon;
              const count = "count" in item ? counts[item.count] : undefined;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  activeOptions={{ exact: item.to === "/" }}
                  className="group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-fg-2 transition-colors hover:bg-hover hover:text-fg data-[status=active]:bg-raised data-[status=active]:text-fg"
                >
                  <Icon size={15} className="text-fg-3 group-data-[status=active]:text-fg" />
                  {item.label}
                  {count !== undefined && <span className="tabular ml-auto text-[11.5px] text-fg-4">{count}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Crumbs() {
  const matches = useMatches();
  const params = useParams({ strict: false }) as { id?: string; cluster?: string };
  const leaf = matches.at(-1);
  const title = leaf?.staticData?.title;
  const base = leaf?.fullPath.split("/").slice(0, 2).join("/") || "/";
  const items: { label: string; to?: string }[] = [];
  const entity = params.id ?? params.cluster;
  if (title) items.push({ label: title, to: entity ? base : undefined });
  if (entity) items.push({ label: entity });
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
      {items.map((c, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <ChevronRight size={13} className="text-fg-4" />}
          {c.to ? (
            <Link to={c.to} className="text-fg-3 hover:text-fg">
              {c.label}
            </Link>
          ) : (
            <span className="truncate text-fg">{c.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

function Palette({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { data } = useView();
  const groups: CommandGroup[] = [
    { heading: "Pages", items: NAV.flatMap((g) => g.items.map((i) => ({ id: i.to, label: i.label, icon: <i.icon size={15} />, onSelect: () => navigate({ to: i.to }) }))) },
  ];
  if (data) {
    groups.push({
      heading: "Narratives",
      items: data.report.narratives.slice(0, 30).map((n) => ({ id: `n-${n.id}`, label: `${n.id} · ${truncate(n.sample, 70)}`, keywords: n.tags, icon: <MessagesSquare size={15} />, onSelect: () => navigate({ to: "/narratives/$id", params: { id: n.id } }) })),
    });
    groups.push({
      heading: "Clusters",
      items: data.report.clusters.map((c) => ({ id: `c-${c.id}`, label: `${c.id} · ${c.members.length} accounts`, icon: <Boxes size={15} />, onSelect: () => navigate({ to: "/clusters/$id", params: { id: c.id } }) })),
    });
  }
  return (
    <CommandPalette groups={groups} placeholder="Jump to a page, narrative or cluster…">
      {children}
    </CommandPalette>
  );
}

export function Shell() {
  const [menu, setMenu] = useState(false);
  return (
    <div className="flex min-h-screen bg-page text-fg">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-line bg-frame px-3 py-4 lg:flex">
        <Brand />
        <Nav />
        <div className="mt-auto">
          <SourceCard />
        </div>
      </aside>
      <Sheet open={menu} onOpenChange={setMenu} side="left">
        <SheetContent width={272}>
          <div className="flex h-full flex-col gap-6 px-3 py-4">
            <Brand />
            <Nav onNavigate={() => setMenu(false)} />
            <div className="mt-auto">
              <SourceCard />
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-(--z-sticky) flex h-13 items-center gap-3 border-b border-line bg-page px-4 lg:px-8">
          <button onClick={() => setMenu(true)} className="grid size-8 place-items-center rounded-md text-fg-2 hover:bg-hover lg:hidden" aria-label="Menu">
            <Menu size={17} />
          </button>
          <Crumbs />
          <div className="ml-auto w-full max-w-[260px]">
            <Palette>
              <CommandPaletteTrigger label="Search…" />
            </Palette>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-7 lg:px-8">
          <Outlet />
        </main>
      </div>
      <Toaster position="bottom-right" />
    </div>
  );
}
