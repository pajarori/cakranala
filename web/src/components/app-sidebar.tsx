import type * as React from "react";
import { Logo } from "@/components/logo";
import { Link } from "@tanstack/react-router";
import { FileText, LockKeyhole, Users, LayoutDashboard, ScanEye, Settings, ShieldAlert, UserSearch } from "lucide-react";
import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useLiveState } from "@/lib/queries";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { data } = useLiveState();
  const open = data?.cases.filter((c) => c.active && c.status !== "dismissed").length;
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link to="/">
                <Logo className="!size-6" />
                <span className="text-base font-semibold">Cakra Nala</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={[
            { title: "Situation", url: "/", icon: LayoutDashboard },
            { title: "Threats", url: "/threats", icon: ShieldAlert, badge: open },
            { title: "Actors", url: "/actors", icon: UserSearch },
            { title: "Monitors", url: "/monitors", icon: ScanEye },
            { title: "Reports", url: "/reports", icon: FileText },
          ]}
        />
        <NavDocuments />
        <NavSecondary
          className="mt-auto"
          items={[
            { title: "System", url: "/system", icon: Settings },
            { title: "Credentials", url: "/credentials", icon: LockKeyhole },
            { title: "Users", url: "/users", icon: Users },
          ]}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
