import { useRef, useState } from "react";
import { createRoute, Link } from "@tanstack/react-router";
import { ImagePlus, X } from "lucide-react";
import { rootRoute } from "@/routes/root";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useShield } from "@/lib/queries";
import { approx, int } from "@/lib/format";
import type { ShieldResult } from "@/lib/api";

const SAMPLE = "PENDAFTARAN BINTARA JALUR KHUSUS!!! Kuota terbatas, dijamin lolos. Transfer biaya admin Rp2.500.000 ke 081234567890, daftar di ad-rekrutmen-tni.com/daftar sebelum besok!!";

const RISK = { tinggi: { label: "High risk", variant: "destructive" }, sedang: { label: "Medium risk", variant: "secondary" }, rendah: { label: "Low risk", variant: "outline" } } as const;

function Highlighted({ text, quotes }: { text: string; quotes: string[] }) {
  const parts: { s: string; hit: boolean }[] = [{ s: text, hit: false }];
  for (const q of quotes.filter((q) => q.length > 3))
    for (let i = 0; i < parts.length; i++) {
      const at = parts[i].hit ? -1 : parts[i].s.toLowerCase().indexOf(q.toLowerCase());
      if (at < 0) continue;
      const p = parts[i].s;
      parts.splice(i, 1, { s: p.slice(0, at), hit: false }, { s: p.slice(at, at + q.length), hit: true }, { s: p.slice(at + q.length), hit: false });
      i++;
    }
  return <p className="whitespace-pre-wrap break-words leading-relaxed">{parts.map((p, i) => (p.hit ? <mark key={i} className="rounded-sm bg-destructive/20 px-0.5 text-foreground">{p.s}</mark> : <span key={i}>{p.s}</span>))}</p>;
}

function Result({ r }: { r: ShieldResult }) {
  const consensus = r.matches.filter((m) => m.kind !== "pustaka").slice(0, 2);
  const checks = r.matches.filter((m) => m.kind === "pustaka");
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Badge variant={RISK[r.risk].variant}>{RISK[r.risk].label}</Badge>
            <span className="text-sm font-normal text-muted-foreground tabular-nums">score {Math.round(r.score * 100)} of 100</span>
          </CardTitle>
          {r.summary && <CardDescription className="text-base leading-relaxed text-foreground">{r.summary}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/40 p-4">
            <Highlighted text={r.text} quotes={r.techniques.map((t) => t.quote)} />
          </div>
        </CardContent>
      </Card>
      {!!consensus.length && (
        <Card>
          <CardHeader>
            <CardTitle>Consensus context</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {consensus.map((m) => (
              <p key={`${m.kind}${m.ref}`}>
                Matches a narrative that {int(m.supporters ?? 0)} accounts appear to push{m.sie !== undefined ? <>, but only <span className="font-medium">{approx(m.sie)} are independent</span></> : ""}.
              </p>
            ))}
          </CardContent>
        </Card>
      )}
      {!!checks.length && (
        <Card>
          <CardHeader>
            <CardTitle>Fact checks</CardTitle>
            <CardDescription>TurnBackHoax.id by MAFINDO</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {checks.map((m) => (
              <a key={m.ref} href={m.ref} target="_blank" rel="noreferrer" className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 hover:underline">
                <Badge variant="destructive">{m.verdict}</Badge>
                <span>{m.title ?? m.text}</span>
              </a>
            ))}
          </CardContent>
        </Card>
      )}
      {!!r.techniques.length && (
        <Card>
          <CardHeader>
            <CardTitle>Manipulation techniques</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {r.techniques.map((t) => (
              <div key={t.name + t.quote} className="py-3 first:pt-0 last:pb-0">
                <div className="font-medium">{t.name}</div>
                <div className="text-sm">“{t.quote}”</div>
                <div className="mt-1 text-sm text-muted-foreground">{t.why}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {(!!r.urls.length || !!r.cues.length) && (
        <Card>
          <CardHeader>
            <CardTitle>Signals</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {r.urls.map((u) => (
              <div key={u.url} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{u.host}</span>
                {u.flags.length ? u.flags.map((f) => <Badge key={f} variant="destructive">{f}</Badge>) : <Badge variant="outline">no flags</Badge>}
              </div>
            ))}
            {r.cues.map((c) => (
              <div key={c} className="text-muted-foreground">
                {c}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Advice</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5">
            {r.advice.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

const readImage = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

function Perisai() {
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ name: string; data: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const shield = useShield();
  const ready = !!text.trim() || !!image;
  const run = () => ready && !shield.isPending && shield.mutate({ text: text.trim() || undefined, image: image?.data });
  const accept = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Images only");
    if (file.size > 4_000_000) return setError("Image must be under 4 MB");
    setError(null);
    setImage({ name: file.name, data: await readImage(file) });
  };
  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <div className="grid gap-4 @5xl/main:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Check a message</CardTitle>
            <CardDescription>For the public: paste a message or screenshot you received before trusting or sharing it</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="msg">Message</Label>
              <Textarea id="msg" rows={8} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && run()} placeholder="Paste a message, link or post…" />
            </div>
            {image ? (
              <div className="flex items-center gap-3 rounded-lg border p-2">
                <img src={image.data} alt="" className="size-12 rounded-md object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm">{image.name}</span>
                <Button variant="ghost" size="icon" onClick={() => setImage(null)} aria-label="Remove image">
                  <X />
                </Button>
              </div>
            ) : (
              <>
                <Button variant="outline" className="h-14 border-dashed" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), accept(e.dataTransfer.files[0]))} onPaste={(e) => accept(e.clipboardData.files[0])}>
                  <ImagePlus />
                  Add a screenshot
                </Button>
                <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => accept(e.target.files?.[0])} />
              </>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={() => setText(SAMPLE)}>
              Load sample
            </Button>
            <Button onClick={run} disabled={!ready || shield.isPending}>
              {shield.isPending && <Spinner />}
              Check message
            </Button>
          </CardFooter>
        </Card>
        <div>
          {shield.error && (
            <Alert variant="destructive">
              <AlertTitle>Check failed</AlertTitle>
              <AlertDescription>{shield.error.message}</AlertDescription>
            </Alert>
          )}
          {shield.data ? (
            <Result r={shield.data} />
          ) : (
            !shield.error && (
              <Empty className="h-full border">
                <EmptyHeader>
                  <EmptyTitle>The analysis appears here</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export const perisaiRoute = createRoute({ getParentRoute: () => rootRoute, path: "/perisai", staticData: { title: "Perisai" }, component: Perisai });
