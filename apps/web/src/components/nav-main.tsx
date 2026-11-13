import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export type NavItem = { title: string; url: string; icon: LucideIcon; badge?: number; items?: { title: string; url: string }[] };

export function useIsActive() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (url: string) => (url === "/" ? path === "/" : path === url || path.startsWith(`${url}/`));
}

export function NavMain({ label, items }: { label: string; items: NavItem[] }) {
  const isActive = useIsActive();
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[13px]">{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible key={item.url} asChild defaultOpen={isActive(item.url)}>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url)} className="h-9 text-[15px]">
                <Link to={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
              {item.badge !== undefined && !item.items?.length && <SidebarMenuBadge className="tabular">{item.badge}</SidebarMenuBadge>}
              {item.items?.length ? (
                <>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction className="data-[state=open]:rotate-90">
                      <ChevronRight />
                      <span className="sr-only">Toggle {item.title}</span>
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((sub) => (
                        <SidebarMenuSubItem key={sub.url}>
                          <SidebarMenuSubButton asChild isActive={isActive(sub.url)} className="text-[14px]">
                            <Link to={sub.url}>
                              <span>{sub.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              ) : null}
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
