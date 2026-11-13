import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { AsyncButton } from "@/components/ui/async-button";
import { Dropzone } from "@/components/ui/dropzone";
import { Card, ErrorState, Meter, PageHeader, Pill } from "@/components/primitives";
import { useShield } from "@/lib/queries";
import { int, num } from "@/lib/format";
import type { ShieldResult } from "@/lib/api";

const SAMPLE = "PENDAFTARAN BINTARA JALUR KHUSUS!!! Kuota terbatas, dijamin lolos. Transfer biaya admin Rp2.500.000 ke 081234567890, daftar di ad-rekrutmen-tni.com/daftar sebelum besok!!";

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
    <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-fg-2">
      {parts.map((p, i) => (p.hit ? <mark key={i} className="rounded-sm bg-warning-soft px-0.5 text-warning">{p.s}</mark> : <span key={i}>{p.s}</span>))}
    </p>
  );
}

function Result({ r }: { r: ShieldResult }) {
  const tone = r.risk === "tinggi" ? "danger" : r.risk === "sedang" ? "warning" : "success";
  const label = { tinggi: "High risk", sedang: "Medium risk", rendah: "Low risk" }[r.risk];
  const consensus = r.matches.filter((m) => m.kind !== "pustaka").slice(0, 2);
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center gap-3">
          <Pill tone={tone}>{label}</Pill>
          <div className="w-40">
            <Meter value={r.score} tone={tone} />
          </div>
          <span className="tabular text-[12.5px] text-fg-3">{Math.round(r.score * 100)}/100</span>
        </div>
        {r.summary && <p className="mt-4 text-[14.5px] leading-relaxed text-fg">{r.summary}</p>}
        <div className="mt-4 rounded-md border border-line bg-page p-3">
          <Highlighted text={r.text} quotes={r.techniques.map((t) => t.quote)} />
        </div>
      </Card>

      {!!consensus.length && (
        <Card title="Consensus context">
          <ul className="space-y-2.5">
            {consensus.map((m) => (
              <li key={`${m.kind}${m.ref}`} className="text-[14px] leading-relaxed text-fg">
                Matches{" "}
                {m.kind === "narasi" ? (
                  <Link to="/narratives/$id" params={{ id: m.ref }} className="underline decoration-fg-4 underline-offset-2">
                    {m.ref}
                  </Link>
                ) : (
                  <Link to="/clusters/$id" params={{ id: m.ref }} className="underline decoration-fg-4 underline-offset-2">
                    {m.ref}
                  </Link>
                )}
                {m.sie !== undefined ? (
                  <>
                    : {int(m.supporters ?? 0)} accounts appear to agree, <span className="text-success">±{num(m.sie)} independent</span>.
                  </>
                ) : (
                  <>: pushed by {m.supporters} coordinated accounts.</>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!!r.techniques.length && (
        <Card title="Techniques" flush>
          <ul className="divide-y divide-line">
            {r.techniques.map((t) => (
              <li key={t.name + t.quote} className="px-4 py-3">
                <div className="text-[13.5px] font-medium text-fg">{t.name}</div>
                <div className="mt-0.5 text-[13px] text-warning">“{t.quote}”</div>
                <div className="mt-1 text-[13px] text-fg-3">{t.why}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(!!r.urls.length || !!r.cues.length) && (
        <Card title="Signals" flush>
          <ul className="divide-y divide-line text-[13px]">
            {r.urls.map((u) => (
              <li key={u.url} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span className="font-mono text-fg">{u.host}</span>
                {u.flags.length ? u.flags.map((f) => <Pill key={f} tone="danger">{f}</Pill>) : <Pill tone="success">no flags</Pill>}
              </li>
            ))}
            {r.cues.map((c) => (
              <li key={c} className="px-4 py-2.5 text-fg-2">
                {c}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Advice" flush>
        <ul className="divide-y divide-line">
          {r.advice.map((a) => (
            <li key={a} className="px-4 py-2.5 text-[13.5px] text-fg">
              {a}
            </li>
          ))}
        </ul>
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

export function Perisai() {
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ name: string; data: string } | null>(null);
  const shield = useShield();
  const run = () => shield.mutateAsync({ text: text.trim() || undefined, image: image?.data });
  return (
    <>
      <PageHeader title="Perisai" eyebrow="Message check" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4">
          <Card>
            <label htmlFor="msg" className="sr-only">
              Message
            </label>
            <textarea
              id="msg"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && (text.trim() || image)) run();
              }}
              rows={8}
              placeholder="Paste a message, link or post…"
              className="w-full resize-y rounded-md border border-line-2 bg-page p-3 text-[16px] leading-relaxed text-fg outline-none placeholder:text-fg-4 focus:border-fg-3 sm:text-[14px]"
            />
            <div className="mt-3">
              {image ? (
                <div className="flex items-center gap-3 rounded-md border border-line-2 p-2">
                  <img src={image.data} alt="" className="size-12 rounded object-cover" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-fg-2">{image.name}</span>
                  <button onClick={() => setImage(null)} className="grid size-7 place-items-center rounded text-fg-3 hover:bg-hover hover:text-fg" aria-label="Remove image">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <Dropzone size="sm" accept="image/*" multiple={false} maxSize={4_000_000} title="Screenshot" onFilesAccepted={async ([f]) => setImage({ name: f.name, data: await readImage(f) })} />
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => setText(SAMPLE)} className="text-[12.5px] text-fg-3 hover:text-fg">
                Load sample
              </button>
              <AsyncButton className="ml-auto" disabled={!text.trim() && !image} pendingLabel="Checking…" onClick={run}>
                Check
              </AsyncButton>
            </div>
          </Card>
        </div>
        <div>
          {shield.error && <ErrorState error={shield.error} />}
          {shield.data ? <Result r={shield.data} /> : !shield.error && <div className="grid h-full min-h-48 place-items-center rounded-lg border border-dashed border-line-2 text-[13px] text-fg-4">Result appears here</div>}
        </div>
      </div>
    </>
  );
}
