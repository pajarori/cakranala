import { useState } from "react";
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { toast } from "sonner";
import { shellRoute } from "@/routes/root";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { meQuery, queryClient, useMe } from "@/lib/queries";

function Login() {
  const navigate = useNavigate();
  const { data } = useMe();
  const setup = !!data?.setup;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <Logo className="size-7" />
          Cakra Nala
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{setup ? "Buat akun pertama" : "Masuk"}</CardTitle>
            {setup && <CardDescription>Belum ada akun</CardDescription>}
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setBusy(true);
                (setup ? api.setup : api.login)({ username, password })
                  .then(async () => {
                    await queryClient.invalidateQueries({ queryKey: ["me"] });
                    navigate({ to: "/" });
                  })
                  .catch((err: Error) => toast.error(err.message))
                  .finally(() => setBusy(false));
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="username">Nama pengguna</FieldLabel>
                  <Input id="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Kata sandi</FieldLabel>
                  <Input id="password" type="password" autoComplete={setup ? "new-password" : "current-password"} required minLength={setup ? 10 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
                <Field>
                  <Button type="submit" disabled={busy}>
                    {busy && <Spinner />}
                    {setup ? "Buat akun" : "Masuk"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const loginRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/login",
  beforeLoad: async () => {
    const me = await queryClient.fetchQuery(meQuery);
    if (me.user) throw redirect({ to: "/" });
  },
  component: Login,
});
