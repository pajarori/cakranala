import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sort?: (row: T) => number | string;
  numeric?: boolean;
  className?: string;
};

export function DataTable<T>({ rows, columns, rowKey, href, initialSort }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; href?: (row: T) => string; initialSort?: { key: string; desc: boolean } }) {
  const [sort, setSort] = useState(initialSort);
  const col = columns.find((c) => c.key === sort?.key);
  const sorted = col?.sort
    ? [...rows].sort((a, b) => {
        const x = col.sort!(a);
        const y = col.sort!(b);
        const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return sort!.desc ? -d : d;
      })
    : rows;
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table className="text-[15px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.key} className={cn("h-11 px-4 text-[14px] font-medium", c.numeric && "text-right", c.className)} aria-sort={sort?.key === c.key ? (sort.desc ? "descending" : "ascending") : undefined}>
                {c.sort ? (
                  <button
                    onClick={() => setSort({ key: c.key, desc: sort?.key === c.key ? !sort.desc : true })}
                    className={cn("inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", c.numeric && "flex-row-reverse")}
                  >
                    {c.header}
                    {sort?.key === c.key && (sort.desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />)}
                  </button>
                ) : (
                  c.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow key={rowKey(row)} className={cn(href && "relative cursor-pointer")}>
              {columns.map((c, i) => (
                <TableCell key={c.key} className={cn("px-4 py-3", c.numeric && "tabular text-right", c.className)}>
                  {i === 0 && href ? (
                    <Link to={href(row)} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring">
                      {c.cell(row)}
                    </Link>
                  ) : (
                    <span className={cn(href && "relative z-10")}>{c.cell(row)}</span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
