import { useState } from "react";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { AtSign, LockKeyhole, Music2, Pause, Play, PlugZap, Plus, RotateCw, Trash2, TvMinimalPlay, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { Section, Summary, Tiles } from "@/components/form-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAddCredential, useCredentialAction, useCredentials } from "@/lib/queries";
import { ago, date, int } from "@/lib/format";
import { api, type Credential, type CredentialPlatform, type Probe } from "@/lib/api";

const PLATFORM: Record<CredentialPlatform, string> = { x: "X", youtube: "YouTube", tiktok: "TikTok" };
const FIELD: Record<string, string> = { authToken: "Cookie auth_token", ct0: "Cookie ct0", userAgent: "User agent dari browser yang sama", cookie: "Header cookie" };

function status(c: Credential) {
  if (!c.active) return <Badge variant="destructive">{c.lastError ? "Dimatikan setelah gagal" : "Dimatikan"}</Badge>;
  if (c.cooldownUntil && c.cooldownUntil > Date.now()) return <Badge variant="outline">Jeda pendinginan</Badge>;
  return <Badge variant="secondary">Siap</Badge>;
}

function Credentials() {
  const { data, error, isPending } = useCredentials();
  const act = useCredentialAction();
  const run = (id: string, action: "enable" | "disable" | "rotate" | "remove" | "test") =>
    act.mutate(
      { id, action },
      {
        onSuccess: (r) => {
          if (action !== "test") return;
          const p = r as Probe;
          if (p.ok) toast.success(p.profile ? `Terhubung sebagai ${p.profile.handle}` : "Terhubung");
          else toast.error(p.error ?? "Koneksi gagal");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <div className="flex items-center justify-end gap-4">
        <Button asChild>
          <Link to="/credentials/new">
            <Plus />
            Tambah kredensial
          </Link>
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{error.message}</AlertTitle>
        </Alert>
      ) : isPending || !data ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : !data.items.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Belum ada kredensial</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/credentials/new">Tambah kredensial</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Akun</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Dipakai</TableHead>
                <TableHead>Terakhir dipakai</TableHead>
                <TableHead>Error terakhir</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.label}</TableCell>
                  <TableCell>
                    {c.profile ? (
                      <div className="min-w-0">
                        <div className="font-medium">{c.profile.handle}</div>
                        <div className="text-sm text-muted-foreground">{c.checkedAt ? `Dicek ${ago(c.checkedAt)}` : ""}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Belum dicek</span>
                    )}
                  </TableCell>
                  <TableCell>{PLATFORM[c.platform]}</TableCell>
                  <TableCell>{status(c)}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(c.uses)}</TableCell>
                  <TableCell className="text-muted-foreground">{c.lastUsed ? ago(c.lastUsed) : "belum pernah"}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">{c.lastError ?? ""}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Tes koneksi" disabled={act.isPending} onClick={() => run(c.id, "test")}>
                        <PlugZap />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Istirahatkan" onClick={() => run(c.id, "rotate")}>
                        <RotateCw />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={c.active ? "Matikan" : "Aktifkan"} onClick={() => run(c.id, c.active ? "disable" : "enable")}>
                        {c.active ? <Pause /> : <Play />}
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Hapus" onClick={() => run(c.id, "remove")}>
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

const ICON: Record<CredentialPlatform, LucideIcon> = { x: AtSign, youtube: TvMinimalPlay, tiktok: Music2 };

function NewCredential() {
  const { data } = useCredentials();
  const add = useAddCredential();
  const navigate = useNavigate();
  const [platform, setPlatform] = useState<CredentialPlatform>("x");
  const [label, setLabel] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const names = data?.platforms[platform]?.fields ?? [];
  const required = data?.platforms[platform]?.required ?? [];
  const of = (p: CredentialPlatform) => data?.items.filter((c) => c.platform === p) ?? [];
  const ready = (p: CredentialPlatform) => of(p).filter((c) => c.active && !(c.cooldownUntil && c.cooldownUntil > Date.now())).length;
  const filled = names.filter((n) => (fields[`${platform}:${n}`] ?? "").trim()).length;
  const values = () => Object.fromEntries(names.map((n) => [n, fields[`${platform}:${n}`] ?? ""]));
  const [result, setResult] = useState<{ key: string; probe: Probe } | undefined>();
  const [testing, setTesting] = useState(false);
  const key = `${platform}:${JSON.stringify(values())}`;
  const probe = result?.key === key ? result.probe : undefined;
  const test = () => {
    setTesting(true);
    api
      .testCredential({ platform, fields: values() })
      .then((p) => {
        setResult({ key, probe: p });
        if (p.ok && p.profile && !label.trim()) setLabel(p.profile.handle.startsWith("@") || p.profile.signedIn === undefined ? p.profile.handle : `TikTok ${p.profile.signedIn ? "masuk" : "anonim"}`);
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setTesting(false));
  };
  return (
    <form
      className="grid gap-4 px-4 md:gap-6 lg:px-6 @5xl/main:grid-cols-[minmax(0,1fr)_360px]"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate(
          { platform, label, fields: values() },
          { onSuccess: () => (toast.success("Kredensial ditambahkan"), navigate({ to: "/credentials" })), onError: (err) => toast.error(err.message) },
        );
      }}
    >
      <div className="flex min-w-0 flex-col gap-4 md:gap-6">
        <Section step={1} title="Platform">
          <Tiles
            value={platform}
            onChange={setPlatform}
            cols="grid-cols-3"
            items={(Object.keys(PLATFORM) as CredentialPlatform[]).map((p) => ({ id: p, label: PLATFORM[p], icon: ICON[p], badge: <Badge variant={ready(p) ? "secondary" : "outline"}>{ready(p)} ready</Badge> }))}
          />
        </Section>
        <Section step={2} title="Sesi">
          <div className="grid gap-4 @3xl/main:grid-cols-2">
            <div className="flex flex-col gap-2 @3xl/main:col-span-2">
              <Label htmlFor="label">Nama</Label>
              <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Opsional, terisi otomatis setelah tes" autoComplete="off" className="h-11" />
            </div>
            {names.map((n) => (
              <div key={`${platform}:${n}`} className={`flex flex-col gap-2 ${n === "cookie" || n === "userAgent" ? "@3xl/main:col-span-2" : ""}`}>
                <Label htmlFor={n}>{FIELD[n] ?? n}</Label>
                <Input
                  id={n}
                  type={n === "userAgent" ? "text" : "password"}
                  required={required.includes(n)}
                  value={fields[`${platform}:${n}`] ?? ""}
                  onChange={(e) => setFields({ ...fields, [`${platform}:${n}`]: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-11 font-mono"
                />
              </div>
            ))}
          </div>
        </Section>
      </div>
      <Summary
        title="Vault"
        rows={[
          ["Koneksi", probe ? <Badge variant={probe.ok ? "secondary" : "destructive"}>{probe.ok ? "Terhubung" : "Gagal"}</Badge> : <span className="text-muted-foreground">Belum dites</span>],
          ...(probe?.ok && probe.profile
            ? ([
                ["Akun", probe.profile.handle],
                ...(probe.profile.name ? [["Nama", probe.profile.name]] : []),
                ...(probe.profile.followers !== undefined ? [["Pengikut", int(probe.profile.followers)]] : []),
                ...(probe.profile.createdAt ? [["Dibuat", date(probe.profile.createdAt)]] : []),
              ] as [string, React.ReactNode][])
            : []),
          ...(probe && !probe.ok ? ([["Error", <span className="text-destructive">{probe.error}</span>]] as [string, React.ReactNode][]) : []),
          ["Isian", `${filled} dari ${names.length}`],
          ...(Object.keys(PLATFORM) as CredentialPlatform[]).map((p) => [PLATFORM[p], `${ready(p)} siap dari ${of(p).length}`] as [string, string]),
        ]}
      >
        <Button type="button" variant="outline" className="w-full" disabled={testing || required.some((n) => !(fields[`${platform}:${n}`] ?? "").trim())} onClick={test}>
          {testing ? <Spinner /> : <PlugZap />}
          Tes koneksi
        </Button>
        <Button type="submit" className="w-full" disabled={add.isPending || !names.length}>
          {add.isPending ? <Spinner /> : <LockKeyhole />}
          Simpan terenkripsi
        </Button>
        <Button type="button" variant="ghost" className="w-full" asChild>
          <Link to="/credentials">Batal</Link>
        </Button>
      </Summary>
    </form>
  );
}

export const credentialsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/credentials", component: Credentials, staticData: { title: "Credentials" } });
export const newCredentialRoute = createRoute({ getParentRoute: () => rootRoute, path: "/credentials/new", component: NewCredential, staticData: { title: "New credential" } });
