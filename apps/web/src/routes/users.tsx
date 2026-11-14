import { useState } from "react";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button asChild>
          <Link to="/users/new">
            <Plus />
            Add user
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
                <TableHead>Username</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last sign in</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.username} {u.id === me?.user?.id && <Badge variant="secondary">You</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{date(u.createdAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{u.lastLogin ? ago(u.lastLogin) : "never"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Change password" asChild>
                        <Link to="/users/$id/password" params={{ id: u.id }}>
                          <KeyRound />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Remove" disabled={u.id === me?.user?.id} onClick={() => act.mutate({ kind: "remove", id: u.id }, { onSuccess: () => toast.success("User removed"), onError: (e) => toast.error(e.message) })}>
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
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <form
        className="max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          act.mutate(id ? { kind: "password", id, password } : { kind: "add", username, password }, {
            onSuccess: () => (toast.success(id ? "Password changed" : "User added"), navigate({ to: "/users" })),
            onError: (err) => toast.error(err.message),
          });
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>{id ? "Change password" : "New user"}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {!id && (
                <Field>
                  <FieldLabel htmlFor="username">Username</FieldLabel>
                  <Input id="username" required autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input id="password" type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline" asChild>
              <Link to="/users">Cancel</Link>
            </Button>
            <Button type="submit" disabled={act.isPending}>
              {act.isPending && <Spinner />}
              Save
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

export const usersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/users", component: Users, staticData: { title: "Users" } });
export const newUserRoute = createRoute({ getParentRoute: () => rootRoute, path: "/users/new", component: () => <UserForm />, staticData: { title: "New user" } });
export const passwordRoute = createRoute({ getParentRoute: () => rootRoute, path: "/users/$id/password", component: () => <UserForm id={passwordRoute.useParams().id} />, staticData: { title: "Change password" } });
