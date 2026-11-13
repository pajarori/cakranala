import { useState } from "react";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { Pause, Play, Plus, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAddCredential, useCredentialAction, useCredentials } from "@/lib/queries";
import { ago, int } from "@/lib/format";
import type { Credential, CredentialPlatform } from "@/lib/api";

const PLATFORM: Record<CredentialPlatform, string> = { x: "X", youtube: "YouTube", tiktok: "TikTok" };
const FIELD: Record<string, string> = { authToken: "auth_token cookie", ct0: "ct0 cookie", userAgent: "User agent", cookie: "Cookie header" };

function status(c: Credential) {
  if (!c.active) return <Badge variant="destructive">{c.lastError ? "Disabled after errors" : "Disabled"}</Badge>;
  if (c.cooldownUntil && c.cooldownUntil > Date.now()) return <Badge variant="outline">Cooling down</Badge>;
  return <Badge variant="secondary">Ready</Badge>;
}

function Credentials() {
  const { data, error, isPending } = useCredentials();
  const act = useCredentialAction();
  const run = (id: string, action: "enable" | "disable" | "rotate" | "remove") => act.mutate({ id, action }, { onError: (e) => toast.error(e.message) });
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
          <AlertDescription>
            <Link to="/operator" className="underline">
              Sign in as operator
            </Link>
          </AlertDescription>
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
                  <TableCell>{PLATFORM[c.platform]}</TableCell>
                  <TableCell>{status(c)}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(c.uses)}</TableCell>
                  <TableCell className="text-muted-foreground">{c.lastUsed ? ago(c.lastUsed) : "never"}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">{c.lastError ?? ""}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
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

function NewCredential() {
  const { data } = useCredentials();
  const add = useAddCredential();
  const navigate = useNavigate();
  const [platform, setPlatform] = useState<CredentialPlatform>("x");
  const [label, setLabel] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const names = data?.platforms[platform] ?? [];
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <form
        className="max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(
            { platform, label, fields: Object.fromEntries(names.map((n) => [n, fields[`${platform}:${n}`] ?? ""])) },
            { onSuccess: () => (toast.success("Credential added"), navigate({ to: "/credentials" })), onError: (err) => toast.error(err.message) },
          );
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>New credential</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <ToggleGroup type="single" variant="outline" value={platform} onValueChange={(v) => v && setPlatform(v as CredentialPlatform)} className="w-full">
              {(Object.keys(PLATFORM) as CredentialPlatform[]).map((p) => (
                <ToggleGroupItem key={p} value={p} className="flex-1">
                  {PLATFORM[p]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <div className="flex flex-col gap-2">
              <Label htmlFor="label">Name</Label>
              <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Optional" autoComplete="off" />
            </div>
            {names.map((n) => (
              <div key={`${platform}:${n}`} className="flex flex-col gap-2">
                <Label htmlFor={n}>{FIELD[n] ?? n}</Label>
                <Input
                  id={n}
                  type={n === "userAgent" ? "text" : "password"}
                  required={n !== "userAgent"}
                  value={fields[`${platform}:${n}`] ?? ""}
                  onChange={(e) => setFields({ ...fields, [`${platform}:${n}`]: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            ))}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline" asChild>
              <Link to="/credentials">Cancel</Link>
            </Button>
            <Button type="submit" disabled={add.isPending || !names.length}>
              {add.isPending && <Spinner />}
              Save encrypted
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

export const credentialsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/credentials", component: Credentials, staticData: { title: "Credentials" } });
export const newCredentialRoute = createRoute({ getParentRoute: () => rootRoute, path: "/credentials/new", component: NewCredential, staticData: { title: "New credential" } });
