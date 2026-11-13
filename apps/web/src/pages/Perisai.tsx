import { useState } from "react";
import type { ShieldResult } from "cakranala";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/kit";
import { api, fmt, type View } from "@/lib/api";

const SAMPLE = "PENDAFTARAN BINTARA JALUR KHUSUS!!! Kuota terbatas, dijamin lolos. Transfer biaya admin Rp2.500.000 ke 081234567890, daftar di ad-rekrutmen-tni.com/daftar sebelum besok!!";

function highlight(text: string, quotes: string[]) {
  const parts: { s: string; hit: boolean }[] = [{ s: text, hit: false }];
  for (const q of quotes.filter((q) => q.length > 3))
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const at = p.hit ? -1 : p.s.toLowerCase().indexOf(q.toLowerCase());
      if (at < 0) continue;
      parts.splice(i, 1, { s: p.s.slice(0, at), hit: false }, { s: p.s.slice(at, at + q.length), hit: true }, { s: p.s.slice(at + q.length), hit: false });
      i++;
    }
  return parts.map((p, i) => (p.hit ? <mark key={i} className="rounded bg-warning-soft px-0.5 text-warning">{p.s}</mark> : <span key={i}>{p.s}</span>));
}

export function Perisai({ view }: { view: View }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [result, setResult] = useState<ShieldResult | null>(null);
  const tone = result?.risk === "tinggi" ? "danger" : result?.risk === "sedang" ? "warning" : "success";

  const onFile = (file?: File) => {
    if (!file) return setImage(undefined);
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Check a message">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="Paste a message, link, or post…"
          className="w-full resize-y rounded-lg border border-line-2 bg-raised p-3 text-[13.5px] leading-relaxed text-fg outline-none placeholder:text-fg-4 focus:border-fg-3"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-md border border-line-2 px-2.5 py-1.5 text-[12.5px] text-fg-2 hover:bg-hover">
            {image ? "Image ✓" : "Screenshot"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <button onClick={() => setText(SAMPLE)} className="text-[12.5px] text-fg-3 underline-offset-2 hover:text-fg hover:underline">
            Sample
          </button>
          <AsyncButton className="ml-auto" disabled={!text.trim() && !image} pendingLabel="Checking…" onClick={() => api.shield({ text: text || undefined, image }).then(setResult)}>
            Check
          </AsyncButton>
        </div>
      </Panel>

      {result && (
        <div className="space-y-5">
          <Panel title="Result" action={<Badge tone={tone} variant="solid">Risiko {result.risk}</Badge>}>
            {result.summary && <p className="mb-3 text-[13.5px] leading-relaxed text-fg">{result.summary}</p>}
            <div className="rounded-lg bg-raised p-3 text-[13px] leading-relaxed text-fg-2">{highlight(result.text, result.techniques.map((t) => t.quote))}</div>
          </Panel>

          {result.matches.some((m) => m.kind !== "pustaka") && (
            <Panel title="Consensus context">
              {result.matches
                .filter((m) => m.kind !== "pustaka")
                .slice(0, 2)
                .map((m) => (
                  <p key={`${m.kind}${m.ref}`} className="text-[13.5px] leading-relaxed text-fg">
                    Mirip dengan {m.kind === "narasi" ? "narasi" : "pesan klaster"} <b>{m.ref}</b>
                    {m.sie !== undefined ? (
                      <> yang tampak didukung {fmt.format(m.supporters ?? 0)} akun, tetapi suara independennya hanya <b className="text-warning">±{fmt.format(m.sie)}</b>.</>
                    ) : (
                      <> yang didorong {m.supporters} akun dalam pola terkoordinasi.</>
                    )}
                  </p>
                ))}
            </Panel>
          )}

          {!!result.techniques.length && (
            <Panel title="Techniques">
              <div className="space-y-3">
                {result.techniques.map((t) => (
                  <div key={t.name + t.quote}>
                    <div className="text-[13px] font-medium text-fg">{t.name}</div>
                    <div className="text-[12.5px] text-warning">“{t.quote}”</div>
                    <div className="text-[12.5px] text-fg-3">{t.why}</div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {(!!result.urls.length || !!result.cues.length) && (
            <Panel title="Signals">
              <ul className="space-y-1.5 text-[13px]">
                {result.urls.map((u) => (
                  <li key={u.url}>
                    <span className="font-mono text-fg-2">{u.host}</span>
                    {u.flags.length ? <span className="text-danger"> — {u.flags.join("; ")}</span> : <span className="text-success"> — tidak ada tanda bahaya</span>}
                  </li>
                ))}
                {result.cues.map((c) => (
                  <li key={c} className="text-fg-2">• {c}</li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Advice">
            <ul className="space-y-1.5 text-[13px] text-fg">
              {result.advice.map((a) => (
                <li key={a}>• {a}</li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
