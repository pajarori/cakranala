import { Link, useRouterState } from "@tanstack/react-router";
import { CirclePlus, type LucideIcon } from "lucide-react";
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export type NavItem = { title: string; url: string; icon: LucideIcon; badge?: number };

export function useIsActive() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (url: string) => (url === "/" ? path === "/" : path === url || path.startsWith(`${url}/`));
}

export function NavMain({ items }: { items: NavItem[] }) {
  const isActive = useIsActive();
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="New monitor" className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground">
              <Link to="/monitors/new">
                <CirclePlus />
                <span>New monitor</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url)}>
                <Link to={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
              {!!item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
