"use client";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type SortDirection = "asc" | "desc";
export type SortState = { column: string; direction: SortDirection } | null;
export type SortValue = string | number | bigint | boolean | Date | null | undefined;

export type SortableColumn<T> = {
  key: string;
  header: React.ReactNode;
  label?: string;
  cell?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => SortValue;
  numeric?: boolean;
  sortable?: boolean;
  firstDirection?: SortDirection;
  width?: number | string;
  className?: string;
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function compareValues(a: SortValue, b: SortValue) {
  const x = a instanceof Date ? a.getTime() : a;
  const y = b instanceof Date ? b.getTime() : b;
  if (typeof x === "number" && typeof y === "number") return x - y;
  if (typeof x === "bigint" && typeof y === "bigint") return x < y ? -1 : x > y ? 1 : 0;
  if (typeof x === "boolean" && typeof y === "boolean") return Number(x) - Number(y);
  return collator.compare(String(x), String(y));
}

const read = <T,>(row: T, col: SortableColumn<T>): SortValue =>
  col.sortValue ? col.sortValue(row) : ((row as Record<string, unknown>)[col.key] as SortValue);

const isEmpty = (v: SortValue) => v == null || v === "" || (typeof v === "number" && Number.isNaN(v));

export function useSortedRows<T>(rows: readonly T[], columns: readonly SortableColumn<T>[], sort: SortState) {
  return useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.column);
    if (!sort || !col) return rows.slice();
    const sign = sort.direction === "asc" ? 1 : -1;
    return rows
      .map((row, index) => ({ row, index, value: read(row, col) }))
      .sort((a, b) => {
        const ea = isEmpty(a.value);
        const eb = isEmpty(b.value);
        if (ea || eb) return ea === eb ? a.index - b.index : ea ? 1 : -1;
        return compareValues(a.value, b.value) * sign || a.index - b.index;
      })
      .map((e) => e.row);
  }, [rows, columns, sort]);
}
export function nextSort<T>(sort: SortState, col: SortableColumn<T>): SortState {
  const first = col.firstDirection ?? (col.numeric ? "desc" : "asc");
  if (!sort || sort.column !== col.key) return { column: col.key, direction: first };
  if (sort.direction === first) return { column: col.key, direction: first === "asc" ? "desc" : "asc" };
  return null;
}
export type SortableTableProps<T> = Omit<React.ComponentProps<"div">, "children" | "defaultValue"> & {
  columns: SortableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  sort?: SortState;
  defaultSort?: SortState;
  onSortChange?: (sort: SortState) => void;
  caption: string;
  size?: "sm" | "md";
  loading?: boolean;
  empty?: React.ReactNode;
  animateLimit?: number;
  minWidth?: number;
};
export function SortableTable<T>({
  columns,
  rows,
  getRowId,
  sort: sortProp,
  defaultSort = null,
  onSortChange,
  caption,
  size = "md",
  loading = false,
  empty = "Nothing here yet",
  animateLimit = 80,
  minWidth,
  className,
  onScroll,
  ...rest
}: SortableTableProps<T>) {
  const [sort, setSort] = useControllableState<SortState>({ value: sortProp, defaultValue: defaultSort, onChange: onSortChange });
  const sorted = useSortedRows(rows, columns, sort);
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [edges, setEdges] = useState({ left: false, right: false });
  const scroller = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const captionId = useId();
  const signature = sort ? `${sort.column}:${sort.direction}` : "none";
  const ids = sorted.map(getRowId);
  const [order, setOrder] = useState({ signature, ids, before: new Map<string, number>() });
  if (order.signature !== signature) {
    setOrder({ signature, ids, before: new Map(order.ids.map((id, i) => [id, i])) });
  }
  const animate = !reduce && sorted.length <= animateLimit;
  const showSkeleton = loading && rows.length === 0;
  const press = (col: SortableColumn<T>) => {
    const next = nextSort(sort, col);
    setSort(next);
    const name = col.label ?? (typeof col.header === "string" ? col.header : col.key);
    setAnnouncement(next ? `Sorted by ${name}, ${next.direction === "asc" ? "ascending" : "descending"}` : "Sort cleared");
  };
  const measure = (el: HTMLDivElement) => {
    setScrolled(el.scrollTop > 0);
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  };
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      data-size={size}
      data-scrolled={scrolled || undefined}
      aria-busy={loading || undefined}
      className={cn("relative flex flex-col overflow-hidden rounded-xl border border-line bg-frame", className)}
      {...rest}
    >
      <div
        ref={scroller}
        onScroll={(e) => {
          onScroll?.(e);
          measure(e.currentTarget);
        }}
        className="max-h-[inherit] min-h-0 flex-1 overflow-auto overscroll-contain"
      >
        <table aria-labelledby={captionId} style={{ minWidth }} className="w-full border-separate border-spacing-0 text-[13px]">
          <caption id={captionId} className="sr-only">
            {caption}
          </caption>
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={c.width != null ? { width: c.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sort?.column === col.key;
                const sortable = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sort!.direction === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "sticky top-0 z-(--z-sticky) whitespace-nowrap border-b border-line bg-frame p-0 font-medium",
                      "before:pointer-events-none before:absolute before:inset-x-0 before:top-full before:h-2 before:bg-linear-to-b before:from-overlay before:to-transparent before:opacity-0 before:transition-opacity before:duration-200 before:content-[''] in-data-scrolled:before:opacity-40",
                      col.numeric ? "text-right" : "text-left",
                    )}
                  >
                    {sortable ? (
                      <SortButton col={col} active={active} direction={active ? sort!.direction : undefined} size={size} onPress={() => press(col)} />
                    ) : (
                      <span className={cn("flex items-center px-3 text-[12px] text-fg-3", size === "sm" ? "h-8" : "h-9", col.numeric && "justify-end")}>
                        {col.header}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {showSkeleton
              ? Array.from({ length: 4 }, (_, r) => (
                  <tr key={r} aria-hidden className="group/row">
                    {columns.map((col, c) => (
                      <td key={col.key} className={cn("border-b border-line px-3 group-last/row:border-b-0", size === "sm" ? "h-8" : "h-10")}>
                        <span
                          className={cn("block h-2.5 rounded-full bg-hover motion-safe:animate-pulse-soft", col.numeric && "ml-auto")}
                          style={{ width: `${[62, 48, 70, 40][(r + c) % 4]}%`, animationDelay: `${r * 120}ms` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : sorted.map((row, index) => (
                  <motion.tr
                    key={getRowId(row)}
                    style={{ zIndex: Math.min(9, Math.max(0, (order.before.get(getRowId(row)) ?? index) - index)) }}
                    layout={animate ? "position" : false}
                    layoutDependency={signature}
                    transition={spring.soft}
                    className="group/row relative bg-frame transition-colors duration-150 hover:bg-hover"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "border-b border-line px-3 text-fg group-last/row:border-b-0",
                          size === "sm" ? "h-8" : "h-10",
                          col.numeric ? "whitespace-nowrap text-right tabular" : "text-left",
                          col.className,
                        )}
                      >
                        {col.cell ? col.cell(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                      </td>
                    ))}
                  </motion.tr>
                ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="h-32 px-4 text-center text-[13px] text-fg-3">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div aria-hidden className={cn("pointer-events-none absolute inset-y-0 left-0 z-(--z-sticky) w-4 bg-linear-to-r from-overlay to-transparent transition-opacity duration-200", edges.left ? "opacity-50" : "opacity-0")} />
      <div aria-hidden className={cn("pointer-events-none absolute inset-y-0 right-0 z-(--z-sticky) w-4 bg-linear-to-l from-overlay to-transparent transition-opacity duration-200", edges.right ? "opacity-50" : "opacity-0")} />
      {loading && rows.length > 0 && (
        <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 z-(--z-sticky) h-px overflow-hidden", size === "sm" ? "top-8" : "top-9")}>
          <div className="h-full w-full origin-left bg-fg-3 motion-safe:animate-indeterminate motion-reduce:opacity-40" />
        </div>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {loading ? "Loading" : announcement}
      </span>
    </div>
  );
}
function SortButton<T>({
  col,
  active,
  direction,
  size,
  onPress,
}: {
  col: SortableColumn<T>;
  active: boolean;
  direction?: SortDirection;
  size: "sm" | "md";
  onPress: () => void;
}) {
  const first = col.firstDirection ?? (col.numeric ? "desc" : "asc");
  const pointing = direction ?? first;
  return (
    <button
      type="button"
      onClick={onPress}
      data-active={active || undefined}
      className={cn(
        "group/sort relative flex w-full select-none items-center gap-1 px-3 text-[12px] outline-none",
        size === "sm" ? "h-8" : "h-9",
        col.numeric && "justify-end",
        "text-fg-3 transition-colors duration-150 hover:text-fg-2 data-active:text-fg",
      )}
    >
      <span
        className={cn(
          "-mx-1.5 flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 transition-transform duration-100 ease-out group-active/sort:scale-[0.97]",
          "group-focus-visible/sort:outline-solid group-focus-visible/sort:outline-1 group-focus-visible/sort:outline-offset-1 group-focus-visible/sort:outline-fg-3",
          col.numeric && "flex-row-reverse",
        )}
      >
        <span className="truncate">{col.header}</span>
        <span
          aria-hidden
          className={cn(
            "grid size-3.5 shrink-0 place-items-center transition-[opacity,color] duration-150",
            active
              ? "text-fg-2 opacity-100"
              : "text-fg-4 opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100 pointer-coarse:opacity-100",
          )}
        >
          <SortArrow pointing={pointing} />
        </span>
      </span>
    </button>
  );
}
function SortArrow({ pointing }: { pointing: SortDirection }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={false}
      animate={{ rotate: pointing === "asc" ? 0 : 180 }}
      transition={reduce ? { duration: 0 } : spring.snappy}
    >
      <path d="M8 13V3M4 7l4-4 4 4" />
    </motion.svg>
  );
}