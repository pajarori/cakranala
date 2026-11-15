import { useState } from "react";
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Logo } from "@/components/logo";
import { RETURN, shellRoute } from "@/routes/root";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { meQuery, queryClient, useMe } from "@/lib/queries";

function takeReturn() {
  try {
    const path = sessionStorage.getItem(RETURN);
    sessionStorage.removeItem(RETURN);
    return path?.startsWith("/") && !path.startsWith("//") ? path : "/";
  } catch {
    return "/";
  }
}

function Login() {
  const navigate = useNavigate();
  const { data } = useMe();
  const setup = !!data?.setup;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden p-0">
            <CardContent className="grid p-0 md:grid-cols-2">
              <form
                className="p-6 md:p-8"
                onSubmit={(e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  (setup ? api.setup : api.login)({ username, password })
                    .then((r) => {
                      queryClient.setQueryData(meQuery.queryKey, { user: r.user, setup: false });
                      navigate({ to: takeReturn(), replace: true });
                    })
                    .catch((err: Error) => setError(err.message))
                    .finally(() => setBusy(false));
                }}
              >
                <FieldGroup>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Logo className="size-10 md:hidden" />
                    <h1 className="text-2xl font-bold">{setup ? "Buat akun pertama" : "Masuk"}</h1>
                  </div>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Field>
                    <FieldLabel htmlFor="username">Nama pengguna</FieldLabel>
                    <Input id="username" autoComplete="username" autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">Kata sandi</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="password"
                        type={show ? "text" : "password"}
                        autoComplete={setup ? "new-password" : "current-password"}
                        required
                        minLength={setup ? 10 : undefined}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton size="icon-xs" aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} onClick={() => setShow(!show)}>
                          {show ? <EyeOff /> : <Eye />}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                    {setup && <FieldDescription>Minimal 10 karakter.</FieldDescription>}
                  </Field>
                  <Field>
                    <Button type="submit" disabled={busy}>
                      {busy ? <Spinner /> : <LockKeyhole />}
                      {setup ? "Buat akun" : "Masuk"}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
              <div className="hidden flex-col items-center justify-center gap-4 bg-muted p-10 md:flex">
                <Logo className="size-28" />
                <span className="text-2xl font-semibold">Cakra Nala</span>
              </div>
            </CardContent>
          </Card>
        </div>
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
