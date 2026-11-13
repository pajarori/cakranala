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
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Counterfactual } from "@/components/counterfactual";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSetStatus } from "@/lib/queries";
import { SEVERITY_VARIANT, STATUS_LABEL, ago, approx, int, ratio } from "@/lib/format";
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

function StatusSelect({ c }: { c: Case }) {
  const set = useSetStatus();
  return (
    <Select value={c.status} onValueChange={(v) => set.mutate({ id: c.id, status: v as CaseStatus })}>
      <SelectTrigger size="sm" className="w-36" aria-label={`Status of ${c.title}`}>
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
  const isMobile = useIsMobile();
  const narratives = state.report?.narratives.filter((n) => c.narratives.includes(n.id)) ?? [];
  const lead = narratives.sort((a, b) => b.supporters - a.supporters)[0];
  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="h-auto w-fit max-w-[420px] justify-start px-0 text-left whitespace-normal text-foreground">
          {c.title}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{c.title}</DrawerTitle>
          <DrawerDescription>
            First seen {ago(c.firstSeen)}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          {lead && !isMobile && <Counterfactual narrative={lead} height={180} />}
          {c.brief && <p className="leading-relaxed">{c.brief}</p>}
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-muted-foreground">Apparent supporters</Label>
              <span className="text-lg font-semibold tabular-nums">{int(c.apparent)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-muted-foreground">Independent voices</Label>
              <span className="text-lg font-semibold tabular-nums">{approx(c.independent)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-muted-foreground">Clusters</Label>
              <span className="text-lg font-semibold tabular-nums">{c.clusters.length}</span>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-muted-foreground">Severity</Label>
              <span className="text-lg font-semibold capitalize">{c.severity}</span>
            </div>
          </div>
        </div>
        <DrawerFooter>
          <Button asChild>
            <Link to="/threats/$id" params={{ id: c.id }}>
              Open case
            </Link>
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

const TABS: { value: string; label: string; match: (c: Case) => boolean }[] = [
  { value: "open", label: "Open", match: (c) => c.status !== "dismissed" && c.status !== "confirmed" },
  { value: "confirmed", label: "Confirmed", match: (c) => c.status === "confirmed" },
  { value: "dismissed", label: "Dismissed", match: (c) => c.status === "dismissed" },
  { value: "all", label: "All", match: () => true },
];

export function DataTable({ state }: { state: State }) {
  const [tab, setTab] = useState("open");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const data = state.cases.filter(TABS.find((t) => t.value === tab)!.match);

  const columns = helper.columns([
    helper.accessor("title", { header: "Threat", cell: ({ row }) => <QuickView c={row.original} state={state} />, enableHiding: false }),
    helper.accessor((c) => RANK[c.severity], {
      id: "severity",
      header: "Severity",
      cell: ({ row }) => (
        <Badge variant={SEVERITY_VARIANT[row.original.severity]} className="capitalize">
          {row.original.severity}
        </Badge>
      ),
    }),
    helper.accessor("status", { header: "Status", cell: ({ row }) => <StatusSelect c={row.original} /> }),
    helper.accessor("apparent", { header: () => <div className="text-right">Apparent</div>, cell: ({ row }) => <div className="text-right tabular-nums">{row.original.active ? int(row.original.apparent) : "dormant"}</div> }),
    helper.accessor((c) => (c.apparent ? inflation({ supporters: c.apparent, sie: { value: c.independent } }) : 0), {
      id: "inflation",
      header: () => <div className="text-right">Inflation</div>,
      cell: ({ getValue }) => <div className="text-right tabular-nums">{getValue() ? ratio(getValue()) : "n/a"}</div>,
    }),
    helper.accessor((c) => c.clusters.length, { id: "clusters", header: () => <div className="text-right">Clusters</div>, cell: ({ getValue }) => <div className="text-right tabular-nums">{getValue()}</div> }),
    helper.accessor("lastSeen", { header: "Last activity", cell: ({ getValue }) => <span className="text-muted-foreground">{ago(getValue())}</span> }),
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
          View
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 />
              <span className="hidden lg:inline">Columns</span>
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem key={column.id} className="capitalize" checked={column.getIsVisible()} onCheckedChange={(value) => column.toggleVisibility(!!value)}>
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
                    No threats here
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">{table.getFilteredRowModel().rows.length} threats</div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
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
              Page {table.state.pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button variant="outline" className="hidden h-8 w-8 p-0 lg:flex" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                <span className="sr-only">First page</span>
                <ChevronsLeft />
              </Button>
              <Button variant="outline" className="size-8" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <span className="sr-only">Previous page</span>
                <ChevronLeft />
              </Button>
              <Button variant="outline" className="size-8" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <span className="sr-only">Next page</span>
                <ChevronRight />
              </Button>
              <Button variant="outline" className="hidden size-8 lg:flex" size="icon" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                <span className="sr-only">Last page</span>
                <ChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
