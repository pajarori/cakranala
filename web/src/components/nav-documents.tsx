import { Link } from "@tanstack/react-router";
import { FileText, MoreHorizontal } from "lucide-react";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { reportsQuery } from "@/lib/queries";

export function NavDocuments() {
  const { data } = useQuery(reportsQuery);
  if (!data?.length) return null;
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Laporan terbaru</SidebarGroupLabel>
      <SidebarMenu>
        {data.slice(0, 4).map((r) => (
          <SidebarMenuItem key={r.id}>
            <SidebarMenuButton asChild>
              <Link to="/reports/$id" params={{ id: r.id }}>
                <FileText />
                <span>{r.content.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem>
          <SidebarMenuButton asChild className="text-sidebar-foreground/70">
            <Link to="/reports">
              <MoreHorizontal className="text-sidebar-foreground/70" />
              <span>Semua laporan</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
