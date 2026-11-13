import { useEffect, useState } from "react";
import { Link, Outlet, useMatches, useNavigate, useParams } from "@tanstack/react-router";
import { Boxes, MessagesSquare, Search } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useView } from "@/lib/queries";
import { truncate } from "@/lib/format";

const PAGES = [
  { to: "/", label: "Overview" },
  { to: "/narratives", label: "Narratives" },
  { to: "/clusters", label: "Clusters" },
  { to: "/network", label: "Network" },
  { to: "/perisai", label: "Perisai" },
  { to: "/evaluation", label: "Evaluation" },
  { to: "/sources", label: "Sources" },
];

function Crumbs() {
  const matches = useMatches();
  const params = useParams({ strict: false }) as { id?: string; scope?: string; actor?: string };
  const leaf = matches.at(-1);
  const title = leaf?.staticData?.title ?? "";
  const entity = params.id ?? (params.scope && params.scope !== "all" ? params.scope : undefined);
  const base = `/${leaf?.fullPath.split("/")[1] ?? ""}`;
  useEffect(() => {
    document.title = [params.actor, entity, title, "Cakra Nala"].filter(Boolean).join(" | ");
  }, [params.actor, entity, title]);
  return (
    <Breadcrumb>
      <BreadcrumbList className="text-[15px]">
        <BreadcrumbItem>{entity || params.actor ? <BreadcrumbLink asChild><Link to={base}>{title}</Link></BreadcrumbLink> : <BreadcrumbPage>{title}</BreadcrumbPage>}</BreadcrumbItem>
        {entity && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{entity}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
        {params.actor && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{params.actor}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function Palette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useView();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="h-9 w-60 justify-start gap-2 px-3 text-[15px] font-normal text-muted-foreground">
        <Search className="size-4" />
        Search
        <kbd className="ml-auto rounded border bg-muted px-1.5 text-[13px]">Ctrl K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to a page, narrative or cluster…" className="text-[16px]" />
        <CommandList>
          <CommandEmpty>No results</CommandEmpty>
          <CommandGroup heading="Pages">
            {PAGES.map((p) => (
              <CommandItem key={p.to} onSelect={() => go(p.to)} className="text-[15px]">
                {p.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {data && (
            <>
              <CommandGroup heading="Narratives">
                {data.report.narratives.slice(0, 40).map((n) => (
                  <CommandItem key={n.id} value={`${n.id} ${n.sample}`} onSelect={() => go(`/narratives/${n.id}`)} className="text-[15px]">
                    <MessagesSquare />
                    <span className="font-medium">{n.id}</span>
                    <span className="truncate text-muted-foreground">{truncate(n.sample, 70)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Clusters">
                {data.report.clusters.map((c) => (
                  <CommandItem key={c.id} value={`${c.id} cluster`} onSelect={() => go(`/clusters/${c.id}`)} className="text-[15px]">
                    <Boxes />
                    <span className="font-medium">{c.id}</span>
                    <span className="text-muted-foreground">{c.members.length} accounts</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

export function Shell() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-5" />
          <Crumbs />
          <div className="ml-auto hidden sm:block">
            <Palette />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </SidebarInset>
      <Toaster position="bottom-right" />
    </SidebarProvider>
  );
}
