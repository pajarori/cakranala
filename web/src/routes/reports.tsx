import { createRoute, Link } from "@tanstack/react-router";
import { Copy, Download, PenLine } from "lucide-react";
import { toast } from "sonner";
import { failure } from "@/components/error-dialog";
import { rootRoute } from "@/routes/root";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { queryClient, reportQuery, reportsQuery, useCounter, useReport, useReports } from "@/lib/queries";
import { date, short } from "@/lib/format";

function Reports() {
  const reports = useReports();
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      {reports.length ? (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Laporan</TableHead>
                <TableHead>Kasus</TableHead>
                <TableHead>Tingkat</TableHead>
                <TableHead>Dibuat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link to="/reports/$id" params={{ id: r.id }} className="font-medium hover:underline">
                      {r.content.title}
                    </Link>
                    <div className="font-mono text-sm text-muted-foreground" title={r.id}>{short(r.id)}</div>
                  </TableCell>
                  <TableCell>
                    <Link to="/threats/$id" params={{ id: r.caseId }} className="font-mono hover:underline" title={r.caseId}>
                      {short(r.caseId)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {r.content.threatLevel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{date(r.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Belum ada laporan</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" asChild>
              <Link to="/threats">Buka kasus untuk membuat laporan</Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}

function ReportView() {
  const { id } = reportRoute.useParams();
  const r = useReport(id);
  const counter = useCounter(id);
  const src = `/api/reports/${r.id}/pdf#view=FitH`;
  const version = r.counter ? r.counter.length : 0;
  return (
    <div className="grid gap-4 px-4 md:gap-6 lg:px-6 @5xl/main:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="overflow-hidden py-0">
        <iframe key={version} title={r.content.title} src={src} className="h-[calc(100svh-9rem)] min-h-[600px] w-full bg-muted" />
      </Card>
      <div className="flex flex-col gap-4 @5xl/main:sticky @5xl/main:top-20 @5xl/main:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="leading-snug">{r.content.title}</CardTitle>
            <CardAction>
              <Badge variant={r.content.threatLevel === "critical" || r.content.threatLevel === "high" ? "destructive" : "secondary"} className="capitalize">
                {r.content.threatLevel}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild>
              <a href={`/api/reports/${r.id}/pdf`} download>
                <Download />
                Unduh PDF
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/threats/$id" params={{ id: r.caseId }}>
                Buka kasus
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kontra narasi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {r.counter && <blockquote className="rounded-lg border-l-4 border-primary bg-muted/50 p-3 text-sm leading-relaxed">{r.counter}</blockquote>}
            <div className="flex gap-2">
              <Button variant={r.counter ? "outline" : "default"} className="flex-1" disabled={counter.isPending} onClick={() => counter.mutate(undefined, { onError: failure("Draf kontra narasi gagal dibuat") })}>
                {counter.isPending ? <Spinner /> : <PenLine />}
                {r.counter ? "Buat ulang draf" : "Buat draf pesan"}
              </Button>
              {r.counter && (
                <Button variant="outline" size="icon" aria-label="Salin" onClick={() => navigator.clipboard.writeText(r.counter!).then(() => toast.success("Disalin"))}>
                  <Copy />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Integritas</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col divide-y text-sm">
              {[
                ["Laporan", short(r.id)],
                ["Diterbitkan", date(r.createdAt)],
                ["SHA-256", r.hash?.slice(0, 16) ?? ""],
                ["Post bukti", String(r.content.evidence?.events ?? 0)],
                ["Entri rantai penguasaan", String(r.custody.length)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2 first:pt-0">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-mono">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const reportsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/reports", staticData: { title: "Reports" }, loader: () => queryClient.ensureQueryData(reportsQuery), component: Reports });
export const reportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports/$id",
  staticData: { title: "Reports" },
  loader: ({ params }) => queryClient.ensureQueryData(reportQuery(params.id)),
  component: ReportView,
});
