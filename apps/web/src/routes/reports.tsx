import { createRoute, Link } from "@tanstack/react-router";
import { Copy, PenLine, Printer } from "lucide-react";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { queryClient, reportQuery, reportsQuery, useCounter, useReport, useReports } from "@/lib/queries";
import { date, short } from "@/lib/format";

function Reports() {
  const reports = useReports();
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-muted-foreground">Commander reports created from threat cases</p>
      </div>
      {reports.length ? (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Threat</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Created</TableHead>
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
            <EmptyTitle>No reports yet</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" asChild>
              <Link to="/threats">Open a threat to create one</Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase print:text-black">{title}</h2>
      {children}
    </section>
  );
}

function ReportView() {
  const { id } = reportRoute.useParams();
  const r = useReport(id);
  const counter = useCounter(id);
  const c = r.content;
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="outline" asChild>
          <Link to="/threats/$id" params={{ id: r.caseId }}>
            Back to threat
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer />
          Print or save as PDF
        </Button>
      </div>
      <article className="mx-auto w-full max-w-3xl rounded-xl border bg-card p-8 print:max-w-none print:border-0 print:bg-white print:p-0 print:text-black">
        <header className="border-b pb-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground print:text-black">
            <span className="font-mono" title={r.id}>Report {short(r.id)}</span>
            <span className="font-mono" title={r.caseId}>Case {short(r.caseId)}</span>
            <span>{date(r.createdAt)}</span>
            <Badge variant="destructive" className="capitalize">
              {c.threatLevel}
            </Badge>
          </div>
          <h1 className="mt-3 text-3xl font-semibold">{c.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground print:text-black">Indicative assessment of coordinated inauthentic behavior. Not an accusation against any individual.</p>
        </header>
        <div className="mt-6 flex flex-col gap-6 leading-relaxed">
          <Section title="Bottom line">
            <p className="text-lg">{c.bluf}</p>
          </Section>
          {c.assessment && (
            <Section title="Assessment">
              <p>{c.assessment}</p>
            </Section>
          )}
          <Section title="Key facts">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {c.facts.map((f) => (
                <div key={f.label} className="flex justify-between gap-4 border-b py-1.5">
                  <dt className="text-muted-foreground print:text-black">{f.label}</dt>
                  <dd className="text-right font-medium capitalize">{f.label === "First seen" ? date(Date.parse(f.value)) : f.value}</dd>
                </div>
              ))}
            </dl>
          </Section>
          {!!c.findings.length && (
            <Section title="Findings">
              <ol className="list-decimal space-y-1.5 pl-5">
                {c.findings.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ol>
            </Section>
          )}
          {!!c.actions.length && (
            <Section title="Recommended actions">
              <ol className="list-decimal space-y-1.5 pl-5">
                {c.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
            </Section>
          )}
          <Section title="Confidence">
            <p className="capitalize">{c.confidence}</p>
          </Section>
          {r.counter && (
            <Section title="Draft public message">
              <blockquote className="rounded-lg border-l-4 border-primary bg-muted/50 p-4 print:bg-white">{r.counter}</blockquote>
            </Section>
          )}
        </div>
      </article>
      <Card className="mx-auto w-full max-w-3xl print:hidden">
        <CardHeader>
          <CardTitle>Counter narrative</CardTitle>
          <CardDescription>Draft a calm public message in Indonesian for the information office, using prebunking</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button disabled={counter.isPending} onClick={() => counter.mutate(undefined, { onError: (e) => toast.error(e.message) })}>
            {counter.isPending ? <Spinner /> : <PenLine />}
            {r.counter ? "Draft again" : "Draft message"}
          </Button>
          {r.counter && (
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(r.counter!).then(() => toast.success("Copied"))}>
              <Copy />
              Copy
            </Button>
          )}
        </CardContent>
      </Card>
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
