import { useState } from "react";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { Globe, LockKeyhole, Pause, Play, PlugZap, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { Section, Summary } from "@/components/form-kit";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAddProxies, useProxies, useProxyAction } from "@/lib/queries";
import { ago, int } from "@/lib/format";
import type { Proxy } from "@/lib/api";

export function VaultTabs({ value }: { value: "sessions" | "proxies" }) {
  return (
    <Tabs value={value}>
      <TabsList>
        <TabsTrigger value="sessions" asChild>
          <Link to="/credentials">Sesi</Link>
        </TabsTrigger>
        <TabsTrigger value="proxies" asChild>
          <Link to="/credentials/proxies">Proxy</Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function status(p: Proxy) {
  if (!p.active) return <Badge variant="destructive">{p.lastError ? "Dimatikan setelah gagal" : "Dimatikan"}</Badge>;
  if (p.failures) return <Badge variant="outline">{p.failures} kali gagal</Badge>;
  return <Badge variant="secondary">Siap</Badge>;
}

function Proxies() {
  const { data, error, isPending } = useProxies();
  const act = useProxyAction();
  const run = (id: string, action: "enable" | "disable" | "remove" | "test") =>
    act.mutate(
      { id, action },
      {
        onSuccess: (r) => {
          if (action !== "test") return;
          const t = r as { ok: boolean; exit?: { ip: string; country: string }; error?: string };
          if (t.ok) toast.success(`Keluar lewat ${t.exit?.ip} ${t.exit?.country}`);
          else toast.error(t.error ?? "Proxy gagal");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <VaultTabs value="proxies" />
        <Button asChild>
          <Link to="/credentials/proxies/new">
            <Plus />
            Tambah proxy
          </Link>
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{error.message}</AlertTitle>
        </Alert>
      ) : isPending || !data ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : !data.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Globe />
            </EmptyMedia>
            <EmptyTitle>Belum ada proxy</EmptyTitle>
            <EmptyDescription>Tanpa proxy, semua sesi keluar dari IP server. Setiap sesi diikat ke satu proxy agar identitas jaringannya tetap.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/credentials/proxies/new">Tambah proxy</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Proxy</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>IP keluar</TableHead>
                <TableHead className="text-right">Sesi terikat</TableHead>
                <TableHead className="hidden @5xl/main:table-cell">Terakhir dipakai</TableHead>
                <TableHead>Error terakhir</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-medium">{p.label}</TableCell>
                  <TableCell>{status(p)}</TableCell>
                  <TableCell>
                    {p.exit ? (
                      <span className="flex items-center gap-2 font-mono">
                        {p.exit.ip}
                        <Badge variant="outline">{p.exit.country}</Badge>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Belum dites</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{int(p.sessions)}</TableCell>
                  <TableCell className="hidden text-muted-foreground @5xl/main:table-cell">{p.lastUsed ? ago(p.lastUsed) : "belum pernah"}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">{p.lastError ?? ""}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Tes proxy" disabled={act.isPending} onClick={() => run(p.id, "test")}>
                        <PlugZap />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={p.active ? "Matikan" : "Aktifkan"} onClick={() => run(p.id, p.active ? "disable" : "enable")}>
                        {p.active ? <Pause /> : <Play />}
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Hapus" onClick={() => run(p.id, "remove")}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function NewProxies() {
  const [list, setList] = useState("");
  const add = useAddProxies();
  const navigate = useNavigate();
  const lines = list.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);
  return (
    <form
      className="grid gap-4 px-4 md:gap-6 lg:px-6 @5xl/main:grid-cols-[minmax(0,1fr)_360px]"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate(list, {
          onSuccess: (r) => (toast.success(`${r.added} proxy ditambahkan${r.skipped ? `, ${r.skipped} sudah ada` : ""}`), navigate({ to: "/credentials/proxies" })),
          onError: (err) => toast.error(err.message),
        });
      }}
    >
      <Section step={1} title="Daftar proxy">
        <div className="flex flex-col gap-2">
          <Label htmlFor="list">Satu proxy per baris</Label>
          <Textarea
            id="list"
            value={list}
            onChange={(e) => setList(e.target.value)}
            placeholder={"http://user:pass@203.0.113.10:8080\n203.0.113.11:8080:user:pass\n203.0.113.12:3128"}
            spellCheck={false}
            className="min-h-64 font-mono"
          />
          <p className="text-sm text-muted-foreground">Format URL http atau https, host:port, atau host:port:user:pass. Proxy dipakai bersama oleh semua platform kecuali TikTok.</p>
        </div>
      </Section>
      <Summary title="Vault" rows={[["Baris terbaca", int(lines.length)]]}>
        <Button type="submit" className="w-full" disabled={add.isPending || !lines.length}>
          {add.isPending ? <Spinner /> : <LockKeyhole />}
          Simpan terenkripsi
        </Button>
        <Button type="button" variant="ghost" className="w-full" asChild>
          <Link to="/credentials/proxies">Batal</Link>
        </Button>
      </Summary>
    </form>
  );
}

export const proxiesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/credentials/proxies", component: Proxies, staticData: { title: "Proxy" } });
export const newProxiesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/credentials/proxies/new", component: NewProxies, staticData: { title: "New proxy" } });
