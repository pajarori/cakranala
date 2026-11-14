import type { CSSProperties } from "react";
import { createRootRoute, createRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { meQuery, queryClient } from "@/lib/queries";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    title?: string;
  }
}

function Layout() {
  return (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <Outlet />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export const shellRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Toaster position="bottom-right" />
    </>
  ),
});

export const rootRoute = createRoute({
  getParentRoute: () => shellRoute,
  id: "app",
  beforeLoad: async () => {
    const me = await queryClient.fetchQuery(meQuery);
    if (!me.user) throw redirect({ to: "/login" });
  },
  component: Layout,
  pendingComponent: () => (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="px-4 lg:px-6">
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : String(error)}
          <Button variant="outline" size="sm" className="mt-2" onClick={reset}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  ),
  notFoundComponent: () => (
    <div className="px-4 lg:px-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Not found</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" asChild>
            <Link to="/">Back to situation</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  ),
});
