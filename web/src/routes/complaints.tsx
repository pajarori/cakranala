import { useMemo, useState } from "react";
import { createRoute, Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink, FlagTriangleRight, Image, Landmark, RotateCw, Send } from "lucide-react";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { threatRoute } from "@/routes/threat";
import { failure } from "@/components/error-dialog";
import { PlatformIcon } from "@/components/platform-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { complaintsQuery, useComplaintItem, useComplaintPlan, useCreateComplaint } from "@/lib/queries";
import { ago, int } from "@/lib/format";
import type { Candidate, ComplaintBatch, ComplaintItem } from "@/lib/api";

const CHANNEL: Record<string, string> = { x: "X", youtube: "YouTube", telegram: "Telegram", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", komdigi: "Komdigi" };

const STATUS: Record<ComplaintItem["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  queued: { label: "Antre", variant: "outline" },
  sent: { label: "Terkirim", variant: "secondary" },
  needs_manual: { label: "Butuh verifikasi", variant: "destructive" },
  failed: { label: "Gagal", variant: "destructive" },
  duplicate: { label: "Sudah dilaporkan", variant: "outline" },
  simulated: { label: "Simulasi", variant: "secondary" },
  unreportable: { label: "Tidak bisa dilaporkan", variant: "outline" },
};

const ChannelIcon = ({ channel }: { channel: string }) => (channel === "komdigi" ? <Landmark className="size-4 shrink-0" /> : <PlatformIcon platform={channel} className="size-4 shrink-0" />);

function ComplaintForm({ caseIds, onDone }: { caseIds: string[]; onDone: (b: ComplaintBatch) => void }) {
  const plan = useComplaintPlan(caseIds);
  const create = useCreateComplaint();
  const [off, setOff] = useState<Set<string>>(new Set());
  const [komdigi, setKomdigi] = useState(true);
  const list = plan.data?.candidates ?? [];
  const groups = useMemo(() => Object.entries(Object.groupBy(list, (c) => c.channel)) as [string, Candidate[]][], [list]);
  const chosen = list.filter((c) => (c.reportable || plan.data?.simulation) && !off.has(c.key));
  const accounts = chosen.filter((c) => c.kind === "account").length;
  const posts = chosen.length - accounts;
  const flip = (keys: string[], on: boolean) => setOff((s) => {
    const n = new Set(s);
    for (const k of keys) on ? n.delete(k) : n.add(k);
    return n;
  });
  if (plan.isPending) return <Skeleton className="h-64" />;
  if (plan.error) return <Alert variant="destructive"><AlertTitle>Target tidak bisa disiapkan</AlertTitle><AlertDescription>{plan.error.message}</AlertDescription></Alert>;
  const blocked = plan.data.blocked;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {plan.data.simulation && (
        <Alert>
          <AlertTitle>Mode simulasi</AlertTitle>
          <AlertDescription>Alurnya sama persis, tapi tidak ada laporan yang benar-benar terkirim.</AlertDescription>
        </Alert>
      )}
      {blocked.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Isi keputusan analis dulu</AlertTitle>
          <AlertDescription>
            Aduan hanya bisa dikirim untuk kasus dengan verdict terkoordinasi.
            {caseIds.length === 1 && (
              <Button variant="link" className="h-auto p-0" asChild>
                <Link to="/threats/$id" params={{ id: caseIds[0] }}>Buka keputusan analis</Link>
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      <p className="text-sm">
        {int(accounts)} akun dan {int(posts)} post di {[...new Set(chosen.map((c) => CHANNEL[c.channel]))].join(", ") || "platform"}
        {komdigi ? ", ditambah 1 aduan Komdigi" : ""}.
      </p>
      <ScrollArea className="min-h-0 flex-1 rounded-lg border">
        <div className="divide-y">
          {groups.map(([channel, items]) => {
            const usable = items.filter((c) => c.reportable || plan.data.simulation);
            const on = usable.filter((c) => !off.has(c.key)).length;
            return (
              <div key={channel} className="grid gap-2 p-3">
                <div className="flex items-center gap-2">
                  <Checkbox id={`all-${channel}`} checked={on === usable.length && on > 0 ? true : on ? "indeterminate" : false} disabled={!usable.length} onCheckedChange={(v) => flip(usable.map((c) => c.key), v === true)} />
                  <Label htmlFor={`all-${channel}`} className="flex items-center gap-2 font-medium">
                    <ChannelIcon channel={channel} />
                    {CHANNEL[channel]}
                  </Label>
                  <Badge variant="outline" className="ml-auto">{on} dari {items.length}</Badge>
                </div>
                {items.map((c) => (
                  <div key={c.key} className="flex items-start gap-2 pl-6 text-sm">
                    <Checkbox id={c.key} className="mt-0.5" checked={(c.reportable || plan.data.simulation) && !off.has(c.key)} disabled={!c.reportable && !plan.data.simulation} onCheckedChange={(v) => flip([c.key], v === true)} />
                    <Label htmlFor={c.key} className="grid min-w-0 gap-0.5 font-normal">
                      <span className="truncate">{c.kind === "account" ? c.label : `"${c.label}"`}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.kind === "account" ? "akun" : `post dari ${c.owner}, teksnya juga diposting akun lain`}
                        {!c.reportable && !plan.data.simulation && ", identitas asli tidak tersedia"}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            );
          })}
          {!groups.length && <p className="p-4 text-sm text-muted-foreground">Tidak ada akun yang bisa dilaporkan ke platform. Aduan Komdigi tetap bisa dikirim.</p>}
        </div>
      </ScrollArea>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <Label htmlFor="komdigi" className="grid gap-0.5">
          <span>Kirim juga ke Komdigi</span>
          <span className="text-xs font-normal text-muted-foreground">Satu aduan berisi semua tautan dan laporan PDF</span>
        </Label>
        <Switch id="komdigi" checked={komdigi} onCheckedChange={setKomdigi} />
      </div>
      <Button
        disabled={create.isPending || blocked.length > 0 || (!chosen.length && !komdigi)}
        onClick={() =>
          create.mutate(
            { caseIds, keys: chosen.map((c) => c.key), komdigi },
            { onSuccess: (b) => (toast.success(b.mode === "simulation" ? "Aduan simulasi dibuat" : "Aduan masuk antrean"), onDone(b)), onError: failure("Aduan tidak bisa dibuat") },
          )
        }
      >
        {create.isPending ? <Spinner /> : <Send />}
        Kirim aduan
      </Button>
    </div>
  );
}

function ManualDialog({ item, batch, onClose }: { item: ComplaintItem; batch: ComplaintBatch; items: ComplaintItem[]; onClose: () => void }) {
  const act = useComplaintItem();
  const [ref, setRef] = useState("");
  const text = `${batch.title}\n\n${batch.text}\n\nTautan:\n${item.channel === "komdigi" ? "" : item.url}`;
  const copy = (s: string) => navigator.clipboard.writeText(s).then(() => toast.success("Disalin"));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChannelIcon channel={item.channel} />
            Selesaikan aduan {CHANNEL[item.channel]}
          </DialogTitle>
          <DialogDescription>{item.error ?? "Sistem tidak bisa menyelesaikan aduan ini sendiri."}</DialogDescription>
        </DialogHeader>
        <ol className="grid list-decimal gap-3 pl-5 text-sm">
          <li>
            Salin teks aduan.
            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 font-sans text-xs whitespace-pre-wrap">{text}</pre>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => copy(text)}>
              <Copy />
              Salin teks
            </Button>
          </li>
          <li>
            Buka form resmi, lalu tempel teksnya dan selesaikan verifikasi.
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={item.url} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  Buka {item.channel === "komdigi" ? "aduankonten.id" : "target"}
                </a>
              </Button>
              {batch.reportId && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/reports/${batch.reportId}/pdf`} target="_blank" rel="noreferrer">
                    Unduh PDF
                  </a>
                </Button>
              )}
            </div>
          </li>
          <li>
            Tandai selesai. Nomor aduan bisa diisi kalau ada.
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Nomor aduan, opsional" className="mt-2 h-9 w-full rounded-md border bg-transparent px-3 text-sm" />
          </li>
        </ol>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Nanti</Button>
          <Button disabled={act.isPending} onClick={() => act.mutate({ id: item.id, action: "done", ref: ref || undefined }, { onSuccess: () => (toast.success("Ditandai terkirim"), onClose()), onError: failure("Item tidak bisa ditandai selesai") })}>
            {act.isPending && <Spinner />}
            Tandai selesai
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchCard({ batch, items }: { batch: ComplaintBatch; items: ComplaintItem[] }) {
  const act = useComplaintItem();
  const [manual, setManual] = useState<ComplaintItem | undefined>();
  const settled = items.filter((i) => i.status !== "queued").length;
  const counts = Object.entries(Object.groupBy(items, (i) => i.status)).map(([s, l]) => [s, l!.length] as const);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{batch.title}</CardTitle>
        <CardDescription>
          Dibuat {ago(batch.createdAt)} oleh {batch.by}
          {batch.mode === "simulation" && ", mode simulasi"}
        </CardDescription>
        <CardAction className="flex flex-wrap justify-end gap-1">
          {counts.map(([s, n]) => (
            <Badge key={s} variant={STATUS[s as ComplaintItem["status"]].variant}>
              {n} {STATUS[s as ComplaintItem["status"]].label.toLowerCase()}
            </Badge>
          ))}
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1">
          <Progress value={(settled / Math.max(1, items.length)) * 100} />
          <p className="text-xs text-muted-foreground">{settled} dari {items.length} selesai diproses</p>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="max-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <ChannelIcon channel={i.channel} />
                      <span className="truncate">{i.kind === "post" ? `"${i.label}"` : i.label}</span>
                    </span>
                    {i.error && <span className="block truncate text-xs text-muted-foreground">{i.error}</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS[i.status].variant}>{STATUS[i.status].label}</Badge>
                    {i.ref && <span className="ml-2 font-mono text-xs text-muted-foreground">{i.ref}</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {i.screenshot && (
                        <Button variant="ghost" size="icon" aria-label="Lihat bukti" asChild>
                          <a href={`/api/complaint-items/${i.id}/screenshot`} target="_blank" rel="noreferrer"><Image /></a>
                        </Button>
                      )}
                      {i.status === "needs_manual" && (
                        <Button size="sm" onClick={() => setManual(i)}>Selesaikan manual</Button>
                      )}
                      {(i.status === "failed" || i.status === "needs_manual") && (
                        <Button variant="outline" size="sm" disabled={act.isPending} onClick={() => act.mutate({ id: i.id, action: "retry" }, { onError: failure("Item tidak bisa dicoba lagi") })}>
                          <RotateCw />
                          Coba lagi
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {manual && <ManualDialog item={manual} batch={batch} items={items} onClose={() => setManual(undefined)} />}
    </Card>
  );
}

function Complaints() {
  const { id } = threatRoute.useParams();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const q = useQuery(complaintsQuery(id));
  const open = path.endsWith("/complaints/new");
  const close = () => navigate({ to: "/threats/$id/complaints", params: { id } });
  return (
    <div className="flex flex-col gap-4">
      {q.isPending ? (
        <Skeleton className="h-48" />
      ) : q.data?.batches.length ? (
        q.data.batches.map((b) => <BatchCard key={b.id} batch={b} items={q.data.items.filter((i) => i.batchId === b.id)} />)
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Belum ada aduan</EmptyTitle>
            <EmptyDescription>Laporkan akun dan post kasus ini ke platform dan Komdigi dengan satu tombol.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button disabled={!q.data?.coordinated} asChild={!!q.data?.coordinated}>
              {q.data?.coordinated ? <Link to="/threats/$id/complaints/new" params={{ id }}><FlagTriangleRight />Laporkan</Link> : <span><FlagTriangleRight />Isi keputusan analis dulu</span>}
            </Button>
          </EmptyContent>
        </Empty>
      )}
      <Sheet open={open} onOpenChange={(o) => !o && close()}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Laporkan</SheetTitle>
            <SheetDescription>Pilih target, lalu kirim. Setiap target dilaporkan sekali dari akun pelapor resmi.</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col px-4">{open && <ComplaintForm caseIds={[id]} onDone={close} />}</div>
          <SheetFooter />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MultiComplaint() {
  const { ids } = useParams({ strict: false }) as { ids: string };
  const navigate = useNavigate();
  const caseIds = ids.split(",").filter(Boolean);
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Card className="mx-auto flex h-[calc(100vh-12rem)] w-full max-w-2xl flex-col">
        <CardHeader>
          <CardTitle>Laporkan {caseIds.length} kasus</CardTitle>
          <CardDescription>Semua target dari kasus terpilih dikirim dalam satu aduan.</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          <ComplaintForm caseIds={caseIds} onDone={() => navigate({ to: "/threats/$id/complaints", params: { id: caseIds[0] } })} />
        </CardContent>
      </Card>
    </div>
  );
}

const complaintsTab = createRoute({ getParentRoute: () => threatRoute, path: "/complaints", component: Complaints });
export const complaintRoutes = complaintsTab.addChildren([createRoute({ getParentRoute: () => complaintsTab, path: "/new", component: () => null })]);
export const multiComplaintRoute = createRoute({ getParentRoute: () => rootRoute, path: "/complaints/$ids", component: MultiComplaint, staticData: { title: "Threats" } });
