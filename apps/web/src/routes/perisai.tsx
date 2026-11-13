import { useRef, useState } from "react";
import { createRoute, Link } from "@tanstack/react-router";
import { ImagePlus, Loader2, X } from "lucide-react";
import { rootRoute } from "@/routes/root";
import { ErrorState, Meter, PageHeader, Panel, Tag, type Tone } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useShield } from "@/lib/queries";
import { approx, int } from "@/lib/format";
import type { ShieldResult } from "@/lib/api";

const SAMPLE = "PENDAFTARAN BINTARA JALUR KHUSUS!!! Kuota terbatas, dijamin lolos. Transfer biaya admin Rp2.500.000 ke 081234567890, daftar di ad-rekrutmen-tni.com/daftar sebelum besok!!";
const MAX_IMAGE = 4_000_000;

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
  return (
    <p className="whitespace-pre-wrap break-words text-[16px] leading-relaxed">
      {parts.map((p, i) => (p.hit ? <mark key={i} className="rounded-sm bg-warning/20 px-0.5 text-warning">{p.s}</mark> : <span key={i}>{p.s}</span>))}
    </p>
  );
}

const RISK: Record<ShieldResult["risk"], { label: string; tone: Tone }> = {
  tinggi: { label: "High risk", tone: "danger" },
  sedang: { label: "Medium risk", tone: "warning" },
  rendah: { label: "Low risk", tone: "success" },
};

function Result({ r }: { r: ShieldResult }) {
  const risk = RISK[r.risk];
  const consensus = r.matches.filter((m) => m.kind !== "pustaka").slice(0, 2);
  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-wrap items-center gap-4">
          <Tag tone={risk.tone} className="h-7 text-[14px]">{risk.label}</Tag>
          <div className="w-44">
            <Meter value={r.score} tone={risk.tone} />
          </div>
          <span className="tabular text-[15px] text-muted-foreground">{Math.round(r.score * 100)} of 100</span>
        </div>
        {r.summary && <p className="mt-5 text-[17px] leading-relaxed">{r.summary}</p>}
        <div className="mt-5 rounded-lg border bg-background p-4">
          <Highlighted text={r.text} quotes={r.techniques.map((t) => t.quote)} />
        </div>
      </Panel>
      {!!consensus.length && (
        <Panel title="Consensus context">
          <ul className="space-y-3">
            {consensus.map((m) => (
              <li key={`${m.kind}${m.ref}`} className="text-[16px] leading-relaxed">
                Matches{" "}
                <Link to={m.kind === "narasi" ? "/narratives/$id" : "/clusters/$id"} params={{ id: m.ref }} className="font-medium underline underline-offset-4">
                  {m.kind === "narasi" ? "narrative" : "cluster"} {m.ref}
                </Link>
                {m.sie !== undefined ? (
                  <>
                    {" "}which {int(m.supporters ?? 0)} accounts appear to support, yet only <span className="font-medium text-success">{approx(m.sie)} are independent</span>.
                  </>
                ) : (
                  <> pushed by {m.supporters} coordinated accounts.</>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {!!r.techniques.length && (
        <Panel title="Techniques" flush>
          <ul className="divide-y">
            {r.techniques.map((t) => (
              <li key={t.name + t.quote} className="px-5 py-4">
                <div className="text-[16px] font-medium">{t.name}</div>
                <div className="mt-1 text-[15px] text-warning">“{t.quote}”</div>
                <div className="mt-1.5 text-[15px] text-muted-foreground">{t.why}</div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {(!!r.urls.length || !!r.cues.length) && (
        <Panel title="Signals" flush>
          <ul className="divide-y text-[15px]">
            {r.urls.map((u) => (
              <li key={u.url} className="flex flex-wrap items-center gap-2 px-5 py-3">
                <span className="font-medium">{u.host}</span>
                {u.flags.length ? u.flags.map((f) => <Tag key={f} tone="danger">{f}</Tag>) : <Tag tone="success">no flags</Tag>}
              </li>
            ))}
            {r.cues.map((c) => (
              <li key={c} className="px-5 py-3 text-muted-foreground">
                {c}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel title="Advice" flush>
        <ul className="divide-y">
          {r.advice.map((a) => (
            <li key={a} className="px-5 py-3 text-[16px]">
              {a}
            </li>
          ))}
        </ul>
      </Panel>
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

function ImageField({ value, onChange }: { value: { name: string; data: string } | null; onChange: (v: { name: string; data: string } | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const accept = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Images only");
    if (file.size > MAX_IMAGE) return setError("Image must be under 4 MB");
    setError(null);
    onChange({ name: file.name, data: await readImage(file) });
  };
  if (value)
    return (
      <div className="flex items-center gap-3 rounded-lg border p-2.5">
        <img src={value.data} alt="" className="size-14 rounded-md object-cover" />
        <span className="min-w-0 flex-1 truncate text-[15px]">{value.name}</span>
        <Button variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Remove image">
          <X />
        </Button>
      </div>
    );
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          accept(e.dataTransfer.files[0]);
        }}
        onPaste={(e) => accept(e.clipboardData.files[0])}
        className={`flex w-full items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-left text-[15px] text-muted-foreground transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${over ? "bg-accent/60" : ""}`}
      >
        <ImagePlus className="size-5" />
        Add a screenshot
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => accept(e.target.files?.[0])} />
      {error && <p className="mt-2 text-[14px] text-destructive">{error}</p>}
    </>
  );
}

function Perisai() {
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ name: string; data: string } | null>(null);
  const shield = useShield();
  const ready = !!text.trim() || !!image;
  const run = () => ready && !shield.isPending && shield.mutate({ text: text.trim() || undefined, image: image?.data });
  return (
    <>
      <PageHeader title="Perisai" meta="Check a message before you trust or share it" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel>
          <label htmlFor="msg" className="mb-2 block text-[15px] font-medium">
            Message
          </label>
          <Textarea
            id="msg"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
            }}
            rows={9}
            placeholder="Paste a message, link or post…"
            className="text-[16px] leading-relaxed"
          />
          <div className="mt-4">
            <ImageField value={image} onChange={setImage} />
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Button variant="ghost" onClick={() => setText(SAMPLE)} className="text-[15px] text-muted-foreground">
              Load sample
            </Button>
            <Button onClick={run} disabled={!ready || shield.isPending} className="ml-auto h-10 px-5 text-[15px]">
              {shield.isPending && <Loader2 className="animate-spin" />}
              Check message
            </Button>
          </div>
        </Panel>
        <div>
          {shield.error && <ErrorState error={shield.error} title="Check failed" />}
          {shield.data && <Result r={shield.data} />}
          {!shield.data && !shield.error && <div className="h-full min-h-56 rounded-xl border border-dashed" />}
        </div>
      </div>
    </>
  );
}

export const perisaiRoute = createRoute({ getParentRoute: () => rootRoute, path: "/perisai", staticData: { title: "Perisai" }, component: Perisai });
