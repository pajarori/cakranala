import { useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { rootRoute } from "@/routes/root";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, operatorToken } from "@/lib/api";

function Operator() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [signedIn, setSignedIn] = useState(() => operatorToken.get() !== "");
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <form
        className="max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          api
            .verifyOperator(token)
            .then(() => {
              operatorToken.set(token);
              toast.success("Signed in");
              navigate({ to: "/" });
            })
            .catch((err: Error) => toast.error(err.message));
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>{signedIn ? "Signed in as operator" : "Operator sign in"}</CardTitle>
          </CardHeader>
          {!signedIn && (
            <CardContent className="flex flex-col gap-2">
              <Label htmlFor="token">Operator token</Label>
              <Input id="token" type="password" required value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
            </CardContent>
          )}
          <CardFooter>
            {signedIn ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  operatorToken.set("");
                  setSignedIn(false);
                }}
              >
                Sign out
              </Button>
            ) : (
              <Button type="submit">Sign in</Button>
            )}
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

export const operatorRoute = createRoute({ getParentRoute: () => rootRoute, path: "/operator", component: Operator, staticData: { title: "Operator" } });
