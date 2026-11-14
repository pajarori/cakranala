import { useState } from "react";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { Section, Summary } from "@/components/form-kit";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMe, useUserAction, useUsers } from "@/lib/queries";
import { ago, date } from "@/lib/format";

function Users() {
  const { data } = useUsers();
  const { data: me } = useMe();
  const act = useUserAction();
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <div className="flex items-center justify-end gap-4">
        <Button asChild>
          <Link to="/users/new">
            <Plus />
            Tambah pengguna
          </Link>
        </Button>
      </div>
      {!data ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Nama pengguna</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead>Terakhir masuk</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.username} {u.id === me?.user?.id && <Badge variant="secondary">Anda</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{date(u.createdAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{u.lastLogin ? ago(u.lastLogin) : "belum pernah"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Ganti kata sandi" asChild>
                        <Link to="/users/$id/password" params={{ id: u.id }}>
                          <KeyRound />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Hapus" disabled={u.id === me?.user?.id} onClick={() => act.mutate({ kind: "remove", id: u.id }, { onSuccess: () => toast.success("Pengguna dihapus"), onError: (e) => toast.error(e.message) })}>
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

function UserForm({ id }: { id?: string }) {
  const act = useUserAction();
  const { data } = useUsers();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const target = data?.find((u) => u.id === id);
  return (
    <form
      className="grid gap-4 px-4 md:gap-6 lg:px-6 @5xl/main:grid-cols-[minmax(0,1fr)_360px]"
      onSubmit={(e) => {
        e.preventDefault();
        act.mutate(id ? { kind: "password", id, password } : { kind: "add", username, password }, {
          onSuccess: () => (toast.success(id ? "Kata sandi diganti" : "Pengguna ditambahkan"), navigate({ to: "/users" })),
          onError: (err) => toast.error(err.message),
        });
      }}
    >
      <div className="flex min-w-0 flex-col gap-4 md:gap-6">
        <Section step={1} title={id ? `Kata sandi baru untuk ${target?.username ?? ""}` : "Akun"}>
          <FieldGroup className="grid gap-4 @3xl/main:grid-cols-2">
            {!id && (
              <Field>
                <FieldLabel htmlFor="username">Nama pengguna</FieldLabel>
                <Input id="username" required autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} className="h-11" />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="password">Kata sandi</FieldLabel>
              <Input id="password" type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
            </Field>
          </FieldGroup>
          <Progress value={Math.min(100, (password.length / 16) * 100)} className="h-1.5" />
        </Section>
      </div>
      <Summary title="Pengguna" rows={(data ?? []).map((u) => [u.username, u.lastLogin ? ago(u.lastLogin) : "belum pernah masuk"] as [string, string])}>
        <Button type="submit" className="w-full" disabled={act.isPending || password.length < 10 || (!id && !username.trim())}>
          {act.isPending && <Spinner />}
          {id ? "Ganti kata sandi" : "Tambah pengguna"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" asChild>
          <Link to="/users">Batal</Link>
        </Button>
      </Summary>
    </form>
  );
}

export const usersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/users", component: Users, staticData: { title: "Users" } });
export const newUserRoute = createRoute({ getParentRoute: () => rootRoute, path: "/users/new", component: () => <UserForm />, staticData: { title: "New user" } });
export const passwordRoute = createRoute({ getParentRoute: () => rootRoute, path: "/users/$id/password", component: () => <UserForm id={passwordRoute.useParams().id} />, staticData: { title: "Change password" } });
