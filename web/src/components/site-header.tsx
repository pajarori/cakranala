import { useEffect, useState } from "react";
import { Link, useMatches, useNavigate, useParams } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { reportsQuery, useLiveState } from "@/lib/queries";
import { SEVERITY_LABEL, short } from "@/lib/format";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

const PAGES = [
  { to: "/", label: "Situation" },
  { to: "/threats", label: "Threats" },
  { to: "/actors", label: "Actors" },
  { to: "/monitors", label: "Monitors" },
  { to: "/monitors/templates", label: "Template pantauan" },
  { to: "/reports", label: "Reports" },
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
        Cari
        <KbdGroup className="ml-auto">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Cari halaman, kasus, atau aktor" />
        <CommandList>
          <CommandEmpty>Tidak ada hasil</CommandEmpty>
          <CommandGroup heading="Halaman">
            {PAGES.map((p) => (
              <CommandItem key={p.to} onSelect={() => go(p.to)}>
                {p.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {!!data?.cases.length && (
            <CommandGroup heading="Kasus">
              {data.cases.map((c) => (
                <CommandItem key={c.id} value={`${c.title} ${c.id}`} onSelect={() => go(`/threats/${c.id}`)}>
                  <span className="truncate">{c.title}</span>
                  <span className="ml-auto text-muted-foreground">{SEVERITY_LABEL[c.severity]}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {!!data?.actors.length && (
            <CommandGroup heading="Aktor">
              {data.actors.slice(0, 50).map((a) => (
                <CommandItem key={a.id} value={`${a.handle ?? ""} ${a.id}`} onSelect={() => go(`/actors/${a.id}`)}>
                  <span className="truncate">{a.handle ?? short(a.id)}</span>
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
  const title = [...matches].reverse().find((m) => m.staticData?.title)?.staticData?.title ?? "";
  const base = `/${leaf?.fullPath.split("/")[1] ?? ""}`;
  const { data } = useLiveState();
  const { data: reports } = useQuery(reportsQuery);
  const entity = params.id && (data?.cases.find((c) => c.id === params.id)?.title ?? reports?.find((r) => r.id === params.id)?.content.title ?? data?.actors.find((a) => a.id === params.id)?.handle ?? short(params.id));
  useEffect(() => {
    document.title = [entity, title, "Cakra Nala"].filter(Boolean).join(" | ");
  }, [entity, title]);
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
                  <BreadcrumbPage className="max-w-[40ch] truncate font-medium">{entity}</BreadcrumbPage>
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
