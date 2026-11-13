import { useEffect, useState } from "react";
import { api, type Capabilities, type View } from "@/lib/api";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/kit";
import { Situasi } from "@/pages/Situasi";
import { Jaringan } from "@/pages/Jaringan";
import { Dosir } from "@/pages/Dosir";
import { Perisai } from "@/pages/Perisai";
import { Arena } from "@/pages/Arena";

const PAGES = [
  { id: "situasi", label: "Situation" },
  { id: "jaringan", label: "Network" },
  { id: "dosir", label: "Dossier" },
  { id: "perisai", label: "Perisai" },
  { id: "arena", label: "Arena" },
] as const;

type PageId = (typeof PAGES)[number]["id"];

const stored = (k: string) => {
  try {
    return sessionStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
};

export function App() {
  const [page, setPage] = useState<PageId>(() => (PAGES.some((p) => p.id === location.hash.slice(1)) ? (location.hash.slice(1) as PageId) : "situasi"));
  const [view, setView] = useState<View | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState(1);
  const [query, setQuery] = useState("");
  const [token, setToken] = useState(() => stored("operator"));
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    api.capabilities().then(setCaps).catch(() => {});
    api.view().then(setView).catch((e) => setError(e.message));
  }, []);
  useEffect(() => void (location.hash = page), [page]);

  const run = (p: Promise<View>) =>
    p.then((v) => {
      setView(v);
      setError(null);
      setFocus(null);
    }).catch((e) => {
      setError(e.message);
      throw e;
    });

  const openCluster = (id: string) => {
    setFocus(id);
    setPage("dosir");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-frame px-3 py-5 md:flex">
        <div className="px-2">
          <div className="text-[15px] font-semibold tracking-tight">Cakra Nala</div>
        </div>
        <nav className="mt-6 flex flex-col gap-0.5">
          {PAGES.map((p) => (
            <button
              key={p.id}
              onClick={() => setPage(p.id)}
              className={`rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${page === p.id ? "bg-raised text-fg" : "text-fg-2 hover:bg-hover hover:text-fg"}`}
            >
              {p.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-10 border-b border-line bg-page/90 px-5 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <select value={page} onChange={(e) => setPage(e.target.value as PageId)} className="h-8 rounded-md border border-line-2 bg-raised px-2 text-[13px] md:hidden">
              {PAGES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {view && (
              <Badge tone={view.source.kind === "sim" ? "warning" : "info"} dot>
                {view.source.kind === "sim" ? "SIMULATION" : "LIVE · PSEUDONYMIZED"}
              </Badge>
            )}
            <span className="truncate text-[12.5px] text-fg-2">{view?.source.label ?? "loading…"}</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Field type="number" min={1} value={seed} onChange={(e) => setSeed(Number(e.target.value) || 1)} className="w-16" aria-label="seed" />
              <AsyncButton size="sm" variant="secondary" onClick={() => run(api.simulate(seed))} pendingLabel="Analyzing…">
                Simulate
              </AsyncButton>
              {caps?.live && (
                <>
                  <Field placeholder="X query" value={query} onChange={(e) => setQuery(e.target.value)} className="w-44" />
                  <Field
                    placeholder="operator token"
                    type="password"
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      try {
                        sessionStorage.setItem("operator", e.target.value);
                      } catch {}
                    }}
                    className="w-32"
                  />
                  <AsyncButton size="sm" onClick={() => run(api.live(query, 5, token).then((r) => r.view))} disabled={!query.trim() || !token} pendingLabel="Collecting…">
                    Collect
                  </AsyncButton>
                </>
              )}
            </div>
          </div>
          {error && <div className="mt-2 text-[12.5px] text-danger">{error}</div>}
        </div>
        <div className="mx-auto max-w-[1400px] px-5 py-5">
          {!view ? (
            <div className="py-24 text-center text-fg-3">Loading…</div>
          ) : page === "situasi" ? (
            <Situasi view={view} onCluster={openCluster} />
          ) : page === "jaringan" ? (
            <Jaringan view={view} onCluster={openCluster} />
          ) : page === "dosir" ? (
            <Dosir view={view} focus={focus} onFocus={setFocus} />
          ) : page === "perisai" ? (
            <Perisai view={view} />
          ) : (
            <Arena view={view} />
          )}
        </div>
      </main>
    </div>
  );
}
