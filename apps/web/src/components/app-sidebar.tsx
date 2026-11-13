import type * as React from "react";
import { Link } from "@tanstack/react-router";
import { Boxes, Database, FlaskConical, LayoutDashboard, MessagesSquare, ShieldCheck, Waypoints } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { useView } from "@/lib/queries";
import { coordinated } from "@/lib/profile";
import { int } from "@/lib/format";

function SourceCard() {
  const { data } = useView();
  if (!data) return null;
  const live = data.source.kind === "x";
  return (
    <Link to="/sources" className="block rounded-md border bg-background/40 p-3 transition-colors hover:bg-sidebar-accent">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <span className={`size-2 rounded-full ${live ? "bg-chart-4" : "bg-warning"}`} />
        {live ? "Live data, pseudonymized" : "Simulation"}
      </div>
      <div className="tabular mt-1 text-[13px] text-muted-foreground">
        {int(data.report.stats.actors)} accounts, {int(data.report.stats.events)} posts
      </div>
    </Link>
  );
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { data } = useView();
  const narratives = data ? coordinated(data) : [];
  const clusters = data?.report.clusters ?? [];
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <span className="font-display text-[22px] font-semibold tracking-wide">CAKRA NALA</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          label="Intelligence"
          items={[
            { title: "Overview", url: "/", icon: LayoutDashboard },
            { title: "Narratives", url: "/narratives", icon: MessagesSquare, items: narratives.slice(0, 6).map((n) => ({ title: `${n.id}  ${n.sample}`, url: `/narratives/${n.id}` })) },
            { title: "Clusters", url: "/clusters", icon: Boxes, items: clusters.map((c) => ({ title: `${c.id}  ${c.members.length} accounts`, url: `/clusters/${c.id}` })) },
            { title: "Network", url: "/network", icon: Waypoints },
          ]}
        />
        <NavMain label="Protection" items={[{ title: "Perisai", url: "/perisai", icon: ShieldCheck }]} />
        <NavSecondary
          className="mt-auto"
          items={[
            { title: "Evaluation", url: "/evaluation", icon: FlaskConical },
            { title: "Sources", url: "/sources", icon: Database },
          ]}
        />
      </SidebarContent>
      <SidebarFooter>
        <SourceCard />
      </SidebarFooter>
    </Sidebar>
  );
}
