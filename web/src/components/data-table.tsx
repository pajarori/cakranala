import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3 } from "lucide-react";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type SortingState,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Counterfactual } from "@/components/counterfactual";
import { useSetStatus } from "@/lib/queries";
import { SEVERITY_LABEL, SEVERITY_VARIANT, STATUS_LABEL, ago, approx, int, ratio } from "@/lib/format";
import { inflation } from "@/lib/profile";
import type { Case, CaseStatus, State } from "@/lib/api";

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
});

const helper = createColumnHelper<typeof features, Case>();
const RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const COLUMN_LABEL: Record<string, string> = { severity: "Tingkat", status: "Status", apparent: "Pendukung", inflation: "Inflasi", clusters: "Akun", lastSeen: "Aktivitas terakhir" };

function StatusSelect({ c }: { c: Case }) {
  const set = useSetStatus();
  return (
    <Select value={c.status} onValueChange={(v) => set.mutate({ id: c.id, status: v as CaseStatus })}>
      <SelectTrigger size="sm" className="w-36" aria-label={`Status ${c.title}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <SelectItem key={k} value={k}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function QuickView({ c, state }: { c: Case; state: State }) {
  const narratives = state.report?.narratives.filter((n) => c.narratives.includes(n.id)) ?? [];
  const lead = [...narratives].sort((a, b) => b.supporters - a.supporters)[0];
  return (
    <HoverCard openDelay={250}>
      <HoverCardTrigger asChild>
        <Link to="/threats/$id" params={{ id: c.id }} className="block max-w-[440px] font-medium whitespace-normal hover:underline">
          {c.title}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-[420px]">
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={SEVERITY_VARIANT[c.severity]}>{SEVERITY_LABEL[c.severity]}</Badge>
            <span className="text-muted-foreground">Pertama terlihat {ago(c.firstSeen)}</span>
          </div>
          {c.brief && <p className="leading-relaxed">{c.brief}</p>}
          {lead && <Counterfactual narrative={lead} height={120} />}
          <Separator />
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Pendukung tampak", int(c.apparent)],
              ["Suara independen", approx(c.independent)],
              ["Cluster", String(c.clusters.length)],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{k}</span>
                <span className="font-semibold tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

const SEVERITIES = ["all", "critical", "high", "medium", "low"] as const;
const PLATFORM_LABEL: Record<string, string> = { all: "Semua platform", x: "X", youtube: "YouTube", telegram: "Telegram", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" };

const TABS: { value: string; label: string; match: (c: Case) => boolean }[] = [
  { value: "open", label: "Terbuka", match: (c) => c.status !== "dismissed" && c.status !== "confirmed" },
  { value: "confirmed", label: "Terkonfirmasi", match: (c) => c.status === "confirmed" },
  { value: "dismissed", label: "Diabaikan", match: (c) => c.status === "dismissed" },
  { value: "all", label: "Semua", match: () => true },
];

export function DataTable({ state }: { state: State }) {
  const [tab, setTab] = useState("open");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("all");
  const [platform, setPlatform] = useState("all");
  const platformOf = new Map(state.monitors.map((m) => [m.id, m.kind === "simulation" ? "demo" : m.platform]));
  const platforms = ["all", ...new Set(state.cases.flatMap((c) => c.monitors.map((m) => platformOf.get(m) ?? "")).filter((p) => p && p !== "demo"))];
  const data = state.cases
    .filter(TABS.find((t) => t.value === tab)!.match)
    .filter((c) => severity === "all" || c.severity === severity)
    .filter((c) => platform === "all" || c.monitors.some((m) => platformOf.get(m) === platform));

  const columns = helper.columns([
    helper.accessor("title", { header: "Kasus", cell: ({ row }) => <QuickView c={row.original} state={state} />, enableHiding: false }),
    helper.accessor((c) => RANK[c.severity], {
      id: "severity",
      header: "Tingkat",
      cell: ({ row }) => <Badge variant={SEVERITY_VARIANT[row.original.severity]}>{SEVERITY_LABEL[row.original.severity]}</Badge>,
    }),
    helper.accessor("status", { header: "Status", cell: ({ row }) => <StatusSelect c={row.original} /> }),
    helper.accessor("apparent", { header: () => <div className="text-right">Pendukung</div>, cell: ({ row }) => <div className="text-right tabular-nums">{row.original.apparent ? int(row.original.apparent) : ""}</div> }),
    helper.accessor((c) => (c.apparent ? inflation({ supporters: c.apparent, sie: { value: c.independent } }) : 0), {
      id: "inflation",
      header: () => <div className="text-right">Inflasi</div>,
      cell: ({ getValue }) => <div className="text-right tabular-nums">{getValue() ? ratio(getValue()) : ""}</div>,
    }),
    helper.accessor((c) => c.members.length, { id: "clusters", header: () => <div className="text-right">Akun</div>, cell: ({ getValue }) => <div className="text-right tabular-nums">{int(getValue())}</div> }),
    helper.accessor("lastSeen", { header: "Aktivitas terakhir", cell: ({ getValue }) => <span className="text-muted-foreground">{ago(getValue())}</span> }),
  ]);

  const table = useTable({
    features,
    data,
    columns,
    state: { sorting, columnVisibility, columnFilters, pagination },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          Tampilan
        </Label>
        <Select value={tab} onValueChange={setTab}>
          <SelectTrigger className="flex w-fit @4xl/main:hidden" size="sm" id="view-selector">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
          {TABS.map((t) => {
            const n = state.cases.filter(t.match).length;
            return (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
                {t.value !== "all" && !!n && <Badge variant="secondary">{n}</Badge>}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" variant="outline" size="sm" value={severity} onValueChange={(v) => v && setSeverity(v as typeof severity)} className="hidden @5xl/main:flex">
            {SEVERITIES.map((s) => (
              <ToggleGroupItem key={s} value={s} className="px-3">
                {s === "all" ? "Semua" : SEVERITY_LABEL[s]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {platforms.length > 2 && (
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger size="sm" className="w-40" aria-label="Platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {platforms.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PLATFORM_LABEL[p] ?? p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 />
              <span className="hidden lg:inline">Kolom</span>
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem key={column.id} checked={column.getIsVisible()} onCheckedChange={(value) => column.toggleVisibility(!!value)}>
                  {COLUMN_LABEL[column.id] ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
      <TabsContent value={tab} className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button onClick={header.column.getToggleSortingHandler()} className="inline-flex w-full items-center gap-1">
                          <FlexRender header={header} />
                        </button>
                      ) : (
                        <FlexRender header={header} />
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className={row.original.active ? "" : "opacity-60"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    Tidak ada kasus
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">{table.getFilteredRowModel().rows.length} kasus</div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Baris per halaman
              </Label>
              <Select value={`${table.state.pagination.pageSize}`} onValueChange={(v) => table.setPageSize(Number(v))}>
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 50].map((s) => (
                    <SelectItem key={s} value={`${s}`}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Halaman {table.state.pagination.pageIndex + 1} dari {Math.max(1, table.getPageCount())}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button variant="outline" className="hidden h-8 w-8 p-0 lg:flex" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                <span className="sr-only">Halaman pertama</span>
                <ChevronsLeft />
              </Button>
              <Button variant="outline" className="size-8" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <span className="sr-only">Halaman sebelumnya</span>
                <ChevronLeft />
              </Button>
              <Button variant="outline" className="size-8" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <span className="sr-only">Halaman berikutnya</span>
                <ChevronRight />
              </Button>
              <Button variant="outline" className="hidden size-8 lg:flex" size="icon" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                <span className="sr-only">Halaman terakhir</span>
                <ChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
