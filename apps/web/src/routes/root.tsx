import type { CSSProperties } from "react";
import { createRootRoute, createRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
      <a href="#primary-content" className="fixed left-4 top-2 z-50 -translate-y-[150%] rounded-md bg-background px-3 py-2 text-sm font-medium shadow-sm outline-none transition-transform focus-visible:translate-y-0 focus-visible:ring-[3px] focus-visible:ring-ring/50">
        Skip to main content
      </a>
      <AppSidebar variant="inset" />
      <SidebarInset id="primary-content" tabIndex={-1} className="focus:outline-none">
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner aria-label="Loading page" />
        <span>Loading page</span>
      </div>
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
        <AlertTitle>Terjadi kesalahan</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : String(error)}
          <Button variant="outline" size="sm" className="mt-2" onClick={reset}>
            Coba lagi
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  ),
  notFoundComponent: () => (
    <div className="px-4 lg:px-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Tidak ditemukan</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" asChild>
            <Link to="/">Kembali ke Situation</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  ),
});
