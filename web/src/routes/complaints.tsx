import { useMemo, useRef, useState } from "react";
import { createRoute, Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Copy, ExternalLink, FlagTriangleRight, Image, Landmark, Link2, RotateCw, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { threatRoute } from "@/routes/threat";
import { failure } from "@/components/error-dialog";
import { PlatformIcon } from "@/components/platform-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
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

const PICKS = [
  { id: "all", label: "Semua", on: () => true },
  { id: "accounts", label: "Akun saja", on: (c: Candidate) => c.kind === "account" },
  { id: "posts", label: "Post saja", on: (c: Candidate) => c.kind === "post" },
  { id: "none", label: "Kosongkan", on: () => false },
] as const;

const remembered = () => {
  try {
    return localStorage.getItem("cakranala.komdigi") !== "0";
  } catch {
    return true;
  }
};

export function ComplaintForm({ caseIds: given, actors, onDone }: { caseIds?: string[]; actors?: string[]; onDone: (b: ComplaintBatch) => void }) {
  const plan = useComplaintPlan(actors ? { actors } : { caseIds: given });
  const caseIds = plan.data?.caseIds ?? given ?? [];
  const create = useCreateComplaint();
  const [off, setOff] = useState<Set<string>>(new Set());
  const [komdigi, setKomdigiState] = useState(remembered);
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const qc = useQueryClient();
  const anchor = useRef<number | null>(null);
  const shift = useRef(false);
  const list = plan.data?.candidates ?? [];
  const usable = (c: Candidate) => c.reportable || !!plan.data?.simulation;
  const q = query.trim().toLowerCase();
  const visible = q ? list.filter((c) => c.label.toLowerCase().includes(q) || c.owner.toLowerCase().includes(q)) : list;
  const groups = useMemo(() => Object.entries(Object.groupBy(visible, (c) => c.channel)) as [string, Candidate[]][], [visible]);
  const flat = groups.flatMap(([, items]) => items);
  const chosen = list.filter((c) => usable(c) && !off.has(c.key));
  const accounts = chosen.filter((c) => c.kind === "account").length;
  const posts = chosen.length - accounts;
  const setKomdigi = (v: boolean) => {
    setKomdigiState(v);
    try {
      localStorage.setItem("cakranala.komdigi", v ? "1" : "0");
    } catch {}
  };
  const flip = (keys: string[], on: boolean) =>
    setOff((s) => {
      const n = new Set(s);
      for (const k of keys) on ? n.delete(k) : n.add(k);
      return n;
    });
  const pick = (on: (c: Candidate) => boolean) =>
    setOff((s) => {
      const n = new Set(s);
      for (const c of visible) on(c) ? n.delete(c.key) : n.add(c.key);
      return n;
    });
  const invert = () =>
    setOff((s) => {
    const n = new Set(s);
    for (const c of visible) if (usable(c)) n.has(c.key) ? n.delete(c.key) : n.add(c.key);
    return n;
  });
  const toggle = (c: Candidate, on: boolean) => {
    const i = flat.indexOf(c);
    if (shift.current && anchor.current !== null) {
      const [a, b] = [Math.min(anchor.current, i), Math.max(anchor.current, i)];
      flip(flat.slice(a, b + 1).filter(usable).map((x) => x.key), on);
    } else flip([c.key], on);
    anchor.current = i;
  };
  const submit = () =>
    create.mutate(
      { caseIds: chosen.length ? [...new Set(chosen.map((c) => c.caseId))] : caseIds, keys: chosen.map((c) => c.key), komdigi },
      { onSuccess: (b) => (toast.success(b.mode === "simulation" ? "Aduan simulasi dibuat" : "Aduan masuk antrean"), onDone(b)), onError: failure("Aduan tidak bisa dibuat") },
    );
  const confirmAll = () => {
    setConfirming(true);
    Promise.all((plan.data?.blocked ?? []).map((id) => api.decide(id, { verdict: "coordinated", confidence: "medium", reasons: [], note: "Dikonfirmasi saat membuat aduan" })))
      .then(() => Promise.all([qc.invalidateQueries({ queryKey: ["complaint-plan"] }), qc.invalidateQueries({ queryKey: ["decision"] }), qc.invalidateQueries({ queryKey: ["state"] })]))
      .then(() => toast.success("Kasus dikonfirmasi"), failure("Konfirmasi gagal"))
      .finally(() => setConfirming(false));
  };
  if (plan.isPending) return <Skeleton className="h-64" />;
  if (plan.error) return <Alert variant="destructive"><AlertTitle>Target tidak bisa disiapkan</AlertTitle><AlertDescription>{plan.error.message}</AlertDescription></Alert>;
  const blocked = plan.data.blocked;
  const ready = !create.isPending && !blocked.length && (chosen.length > 0 || komdigi);
  const go = () => (plan.data.simulation ? submit() : setConfirm(true));
  const total = chosen.length + (komdigi ? 1 : 0);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && ready && go()}>
      {plan.data.simulation && (
        <Alert>
          <AlertTitle>Mode simulasi, tidak ada laporan yang terkirim</AlertTitle>
        </Alert>
      )}
      {blocked.length > 0 && (
        <Alert>
          <AlertTitle>{blocked.length === 1 ? "Kasus ini belum dikonfirmasi" : `${blocked.length} kasus belum dikonfirmasi`}</AlertTitle>
          <AlertDescription className="grid gap-3">
            <Label htmlFor="confirm" className="flex items-start gap-2 font-normal text-foreground">
              <Checkbox id="confirm" className="mt-0.5" checked={reviewed} onCheckedChange={(v) => setReviewed(v === true)} />
              Saya sudah meninjau bukti dan menilai {blocked.length === 1 ? "kasus ini" : "kasus-kasus ini"} sebagai operasi terkoordinasi
            </Label>
            <Button size="sm" className="w-fit" disabled={!reviewed || confirming} onClick={confirmAll}>
              {confirming && <Spinner />}
              Konfirmasi terkoordinasi
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <p className="text-sm">
        {int(accounts)} akun dan {int(posts)} post di {[...new Set(chosen.map((c) => CHANNEL[c.channel]))].join(", ") || "platform"}
        {komdigi ? ", ditambah 1 aduan Komdigi" : ""}.
      </p>
      <div className="grid gap-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari akun atau isi post" className="pl-8" aria-label="Cari target" />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {PICKS.map((p) => (
            <Button key={p.id} type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => pick(p.on)}>
              {p.label}
            </Button>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={invert}>
            Balik pilihan
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 rounded-lg border">
        <div className="divide-y">
          {groups.map(([channel, items]) => {
            const ok = items.filter(usable);
            const on = ok.filter((c) => !off.has(c.key)).length;
            return (
              <div key={channel} className="grid gap-2 p-3">
                <div className="flex items-center gap-2">
                  <Checkbox id={`all-${channel}`} checked={on === ok.length && on > 0 ? true : on ? "indeterminate" : false} disabled={!ok.length} onCheckedChange={(v) => flip(ok.map((c) => c.key), v === true)} />
                  <Label htmlFor={`all-${channel}`} className="flex items-center gap-2 font-medium">
                    <ChannelIcon channel={channel} />
                    {CHANNEL[channel]}
                  </Label>
                  <Badge variant="outline" className="ml-auto">{on} dari {items.length}</Badge>
                </div>
                {items.map((c) => (
                  <div key={c.key} className={`flex items-start gap-2 text-sm ${c.kind === "post" ? "pl-12" : "pl-6"}`}>
                    <Checkbox
                      id={c.key}
                      className="mt-0.5"
                      checked={usable(c) && !off.has(c.key)}
                      disabled={!usable(c)}
                      onClick={(e) => (shift.current = e.shiftKey)}
                      onCheckedChange={(v) => toggle(c, v === true)}
                    />
                    <Label htmlFor={c.key} className="grid min-w-0 gap-0.5 font-normal">
                      <span className="truncate">{c.kind === "account" ? c.label : `"${c.label}"`}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.kind === "account" ? ["akun", list.filter((x) => x.kind === "post" && x.pseudonym === c.pseudonym).length].filter(Boolean).join(", ").replace(/(\d+)$/, "$1 post bukti") : "post bukti"}
                        {!usable(c) && ", identitas asli tidak tersedia"}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            );
          })}
          {!groups.length && <p className="p-4 text-sm text-muted-foreground">{q ? "Tidak ada target yang cocok." : "Tidak ada akun yang bisa dilaporkan ke platform. Aduan Komdigi tetap bisa dikirim."}</p>}
        </div>
      </ScrollArea>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <Label htmlFor="komdigi">Kirim juga ke Komdigi</Label>
        <Switch id="komdigi" checked={komdigi} onCheckedChange={setKomdigi} />
      </div>
      <Button disabled={!ready} onClick={go}>
        {create.isPending ? <Spinner /> : <Send />}
        Kirim {int(total)} aduan
        <Kbd className="ml-auto hidden sm:inline-flex">Ctrl Enter</Kbd>
      </Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kirim {int(total)} aduan sungguhan?</AlertDialogTitle>
            <AlertDialogDescription>
              {int(accounts)} akun dan {int(posts)} post akan dilaporkan ke platform{komdigi ? ", ditambah 1 aduan ke Komdigi" : ""}. Laporan yang sudah terkirim tidak bisa ditarik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={submit}>Kirim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Nomor aduan, opsional" className="mt-2" />
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

const FILTERS = [
  { id: "all", label: "Semua", match: () => true },
  { id: "attention", label: "Perlu tindakan", match: (i: ComplaintItem) => i.status === "needs_manual" || i.status === "failed" },
  { id: "sent", label: "Terkirim", match: (i: ComplaintItem) => i.status === "sent" || i.status === "simulated" },
  { id: "queued", label: "Antre", match: (i: ComplaintItem) => i.status === "queued" },
] as const;

function BatchCard({ batch, items: all }: { batch: ComplaintBatch; items: ComplaintItem[] }) {
  const act = useComplaintItem();
  const [manual, setManual] = useState<ComplaintItem | undefined>();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const items = all.filter(FILTERS.find((f) => f.id === filter)!.match);
  const failed = all.filter((i) => i.status === "failed");
  const settled = all.filter((i) => i.status !== "queued").length;
  const counts = Object.entries(Object.groupBy(all, (i) => i.status)).map(([s, l]) => [s, l!.length] as const);
  const links = all.filter((i) => i.url && i.channel !== "komdigi" && !i.url.startsWith("simulasi:")).map((i) => i.url);
  const retryAll = () => Promise.all(failed.map((i) => act.mutateAsync({ id: i.id, action: "retry" }))).then(() => toast.success(`${failed.length} item dicoba lagi`), failure("Sebagian item tidak bisa dicoba lagi"));
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
          <Progress value={(settled / Math.max(1, all.length)) * 100} />
          <p className="text-xs text-muted-foreground">{settled} dari {all.length} selesai diproses</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)}>
            {FILTERS.map((f) => (
              <ToggleGroupItem key={f.id} value={f.id} className="px-3">
                {f.label}
                <Badge variant="secondary" className="ml-1">{all.filter(f.match).length}</Badge>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="ml-auto flex gap-2">
            {links.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(links.join("\n")).then(() => toast.success(`${links.length} tautan disalin`))}>
                <Link2 />
                Salin semua tautan
              </Button>
            )}
            {failed.length > 0 && (
              <Button variant="outline" size="sm" disabled={act.isPending} onClick={retryAll}>
                <RotateCw />
                Coba lagi {failed.length} yang gagal
              </Button>
            )}
          </div>
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
              {!items.length && (
                <TableRow>
                  <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">Tidak ada item dengan status ini.</TableCell>
                </TableRow>
              )}
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
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/threats/$id/complaints/new" params={{ id }}>
                <FlagTriangleRight />
                Laporkan
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
      <Sheet open={open} onOpenChange={(o) => !o && close()}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Laporkan</SheetTitle>
            <SheetDescription className="sr-only">Target aduan</SheetDescription>
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
