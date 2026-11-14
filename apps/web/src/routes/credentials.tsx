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
const FIELD: Record<string, string> = { authToken: "auth_token cookie", ct0: "ct0 cookie", userAgent: "User agent of the same browser", cookie: "Cookie header" };

function status(c: Credential) {
  if (!c.active) return <Badge variant="destructive">{c.lastError ? "Disabled after errors" : "Disabled"}</Badge>;
  if (c.cooldownUntil && c.cooldownUntil > Date.now()) return <Badge variant="outline">Cooling down</Badge>;
  return <Badge variant="secondary">Ready</Badge>;
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
          if (p.ok) toast.success(p.profile ? `Connected as ${p.profile.handle}` : "Connected");
          else toast.error(p.error ?? "Connection failed");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Credentials</h1>
        <Button asChild>
          <Link to="/credentials/new">
            <Plus />
            Add credential
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
            <EmptyTitle>No credentials</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/credentials/new">Add credential</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Uses</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Last error</TableHead>
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
                        <div className="text-sm text-muted-foreground">{c.checkedAt ? `Checked ${ago(c.checkedAt)}` : ""}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not checked</span>
                    )}
                  </TableCell>
                  <TableCell>{PLATFORM[c.platform]}</TableCell>
                  <TableCell>{status(c)}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(c.uses)}</TableCell>
                  <TableCell className="text-muted-foreground">{c.lastUsed ? ago(c.lastUsed) : "never"}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">{c.lastError ?? ""}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Test connection" disabled={act.isPending} onClick={() => run(c.id, "test")}>
                        <PlugZap />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Rotate out" onClick={() => run(c.id, "rotate")}>
                        <RotateCw />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={c.active ? "Disable" : "Enable"} onClick={() => run(c.id, c.active ? "disable" : "enable")}>
                        {c.active ? <Pause /> : <Play />}
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => run(c.id, "remove")}>
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
        if (p.ok && p.profile && !label.trim()) setLabel(p.profile.signedIn === undefined ? p.profile.handle : `TikTok ${p.profile.signedIn ? "signed in" : "anonymous"} ${new Date().toLocaleDateString("en-GB")}`);
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
          { onSuccess: () => (toast.success("Credential added"), navigate({ to: "/credentials" })), onError: (err) => toast.error(err.message) },
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
        <Section step={2} title="Session">
          <div className="grid gap-4 @3xl/main:grid-cols-2">
            <div className="flex flex-col gap-2 @3xl/main:col-span-2">
              <Label htmlFor="label">Name</Label>
              <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Optional" autoComplete="off" className="h-11" />
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
          ["Connection", probe ? <Badge variant={probe.ok ? "secondary" : "destructive"}>{probe.ok ? "Connected" : "Failed"}</Badge> : <span className="text-muted-foreground">Not tested</span>],
          ...(probe?.ok && probe.profile
            ? ([
                ["Account", probe.profile.handle],
                ...(probe.profile.name ? [["Name", probe.profile.name]] : []),
                ...(probe.profile.followers !== undefined ? [["Followers", int(probe.profile.followers)]] : []),
                ...(probe.profile.createdAt ? [["Created", date(probe.profile.createdAt)]] : []),
              ] as [string, React.ReactNode][])
            : []),
          ...(probe && !probe.ok ? ([["Error", <span className="text-destructive">{probe.error}</span>]] as [string, React.ReactNode][]) : []),
          ["Fields", `${filled} of ${names.length}`],
          ...(Object.keys(PLATFORM) as CredentialPlatform[]).map((p) => [PLATFORM[p], `${ready(p)} ready of ${of(p).length}`] as [string, string]),
        ]}
      >
        <Button type="button" variant="outline" className="w-full" disabled={testing || required.some((n) => !(fields[`${platform}:${n}`] ?? "").trim())} onClick={test}>
          {testing ? <Spinner /> : <PlugZap />}
          Test connection
        </Button>
        <Button type="submit" className="w-full" disabled={add.isPending || !names.length}>
          {add.isPending ? <Spinner /> : <LockKeyhole />}
          Save encrypted
        </Button>
        <Button type="button" variant="ghost" className="w-full" asChild>
          <Link to="/credentials">Cancel</Link>
        </Button>
      </Summary>
    </form>
  );
}

export const credentialsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/credentials", component: Credentials, staticData: { title: "Credentials" } });
export const newCredentialRoute = createRoute({ getParentRoute: () => rootRoute, path: "/credentials/new", component: NewCredential, staticData: { title: "New credential" } });
