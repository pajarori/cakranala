import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleDashed, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { reportsQuery, useCredentials, useUsers } from "@/lib/queries";
import type { State } from "@/lib/api";

const KEY = "cakranala.onboarding.hidden";

const hidden = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export function Onboarding({ state }: { state: State }) {
  const [off, setOff] = useState(hidden);
  const creds = useCredentials();
  const users = useUsers();
  const { data: reports } = useQuery(reportsQuery);
  const steps = [
    { done: !!creds.data?.items.length, title: "Tambah kredensial platform", text: "Sesi X, YouTube, atau TikTok untuk pengumpulan live", to: "/credentials/new", action: "Tambah" },
    { done: state.monitors.some((m) => m.kind !== "simulation"), title: "Buat pantauan pertama", text: "Pilih template topik atau akun yang ingin dipantau", to: "/monitors/templates", action: "Pilih template" },
    { done: state.cases.length > 0, title: "Tinjau kasus pertama", text: "Kasus muncul otomatis saat ada koordinasi yang signifikan", to: "/threats", action: "Buka kasus" },
    { done: !!reports?.length, title: "Buat laporan komandan", text: "Laporan PDF dengan bukti ber-hash dari sebuah kasus", to: "/reports", action: "Lihat laporan" },
    { done: (users.data?.length ?? 0) > 1, title: "Tambah operator", text: "Undang rekan analis agar bisa bekerja bersama", to: "/users/new", action: "Tambah" },
  ];
  const done = steps.filter((s) => s.done).length;
  if (off || done === steps.length || !creds.data || !users.data) return null;
  return (
    <Card className="mx-4 lg:mx-6">
      <CardHeader>
        <CardTitle>Mulai menggunakan Cakra Nala</CardTitle>
        <CardDescription>
          {done} dari {steps.length} langkah selesai
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sembunyikan"
            onClick={() => {
              try {
                localStorage.setItem(KEY, "1");
              } catch {}
              setOff(true);
            }}
          >
            <X />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Progress value={(done / steps.length) * 100} />
        <ItemGroup className="grid gap-2 @3xl/main:grid-cols-2 @6xl/main:grid-cols-3">
          {steps.map((s) => (
            <Item key={s.title} variant="outline" size="sm" className={s.done ? "opacity-60" : ""}>
              <ItemMedia>{s.done ? <CircleCheck className="size-5 text-primary" /> : <CircleDashed className="size-5 text-muted-foreground" />}</ItemMedia>
              <ItemContent>
                <ItemTitle>{s.title}</ItemTitle>
                <ItemDescription>{s.text}</ItemDescription>
              </ItemContent>
              {!s.done && (
                <ItemActions>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={s.to}>{s.action}</Link>
                  </Button>
                </ItemActions>
              )}
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
