import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useLiveState } from "@/lib/queries";
import { ago } from "@/lib/format";

export function NavUser() {
  const { data } = useLiveState();
  const active = data?.monitors.filter((m) => m.active).length ?? 0;
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild>
          <Link to="/monitors">
            <span className="grid size-8 place-items-center rounded-lg bg-muted">
              <Activity className={`size-4 ${data?.analyzing ? "animate-pulse" : ""}`} />
            </span>
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{active} monitors running</span>
              <span className="truncate text-xs text-muted-foreground">{data?.analyzing ? "Analyzing now" : data?.updatedAt ? `Updated ${ago(data.updatedAt)}` : "Starting"}</span>
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
