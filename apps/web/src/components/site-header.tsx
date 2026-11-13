import { useEffect, useState } from "react";
import { Link, useMatches, useNavigate, useParams } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useLiveState } from "@/lib/queries";

const PAGES = [
  { to: "/", label: "Situation" },
  { to: "/threats", label: "Threats" },
  { to: "/monitors", label: "Monitors" },
  { to: "/reports", label: "Reports" },
  { to: "/perisai", label: "Perisai" },
  { to: "/system", label: "System" },
];

function Search_() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useLiveState();
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
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="hidden w-56 justify-start gap-2 text-muted-foreground sm:flex">
        <Search />
        Search threats
        <kbd className="ml-auto rounded border bg-muted px-1.5 text-xs">Ctrl K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages and threats…" />
        <CommandList>
          <CommandEmpty>No results</CommandEmpty>
          <CommandGroup heading="Pages">
            {PAGES.map((p) => (
              <CommandItem key={p.to} onSelect={() => go(p.to)}>
                {p.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {!!data?.cases.length && (
            <CommandGroup heading="Threats">
              {data.cases.map((c) => (
                <CommandItem key={c.id} value={`${c.id} ${c.title}`} onSelect={() => go(`/threats/${c.id}`)}>
                  <span className="font-medium">{c.id}</span>
                  <span className="truncate text-muted-foreground">{c.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

export function SiteHeader() {
  const matches = useMatches();
  const params = useParams({ strict: false }) as { id?: string };
  const leaf = matches.at(-1);
  const title = leaf?.staticData?.title ?? "";
  const base = `/${leaf?.fullPath.split("/")[1] ?? ""}`;
  useEffect(() => {
    document.title = [params.id, title, "Cakra Nala"].filter(Boolean).join(" | ");
  }, [params.id, title]);
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {params.id ? (
                <BreadcrumbLink asChild>
                  <Link to={base}>{title}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-base font-medium">{title}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {params.id && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium">{params.id}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <Search_ />
        </div>
      </div>
    </header>
  );
}
