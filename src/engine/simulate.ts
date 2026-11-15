import { SCHEMA_VERSION, type Action, type Actor, type Dataset, type Event } from "./schema";
import type { Reasoner } from "./ports";
import { expo, gauss, pick, rng, shuffle, type Rng } from "./util";

export type OperationKind = "paid" | "botfarm" | "swarm" | "slowswarm";

export interface Scenario {
  name: string;
  durationMin: number;
  organic: { actors: number; hubs: number; eventsPerActor: number; narrativeShare: number };
  topics: { texts: string[]; tags?: string[] }[];
  narratives: { id: string; claims: string[]; organicTakes: string[]; tags: string[]; paraphrases?: string[] }[];
  viral?: { atMin: number; size: number; texts: string[]; tags: string[] };
  operations: { id: string; kind: OperationKind; size: number; narrative: string; waves: number }[];
  fillers: { openers: string[]; closers: string[]; emoji: string[] };
}

const DAY = 86400000;

function mutate(text: string, r: Rng, level: number, f: Scenario["fillers"]) {
  let parts = text.split(/(?<=[,.!?])\s+/);
  if (parts.length > 1 && r() < level) parts = shuffle(r, parts);
  let words = parts.join(" ").split(" ");
  if (level > 0) words = words.filter((_, i) => i === 0 || r() > level * 0.25);
  let out = words.join(" ");
  if (r() < level) out = `${pick(r, f.openers)} ${out.charAt(0).toLowerCase()}${out.slice(1)}`;
  if (r() < level) out = `${out} ${pick(r, f.closers)}`;
  if (r() < 0.3) out = `${out} ${pick(r, f.emoji)}`;
  return out;
}

function handle(r: Rng, digits: boolean) {
  const syl = ["ra", "di", "an", "sa", "tri", "wan", "ko", "ni", "su", "ma", "yu", "ka", "do", "li", "to", "na", "bi", "ar"];
  const name = Array.from({ length: 2 + Math.floor(r() * 3) }, () => pick(r, syl)).join("");
  return digits ? `${name}${Math.floor(1000 + r() * 9000)}` : r() < 0.3 ? `${name}_${pick(r, syl)}` : name;
}

export function simulate(scenario: Scenario, seed = 1): Dataset {
  const r = rng(seed);
  const t0 = Date.UTC(2026, 10, 13, 0, 0, 0);
  const span = scenario.durationMin * 60000;
  const actors: Actor[] = [];
  const events: Event[] = [];
  const truth: Record<string, string> = {};
  let eid = 0;
  const emit = (actor: string, action: Action, ts: number, text: string, target?: string, tags?: string[]) => {
    const id = `e${++eid}`;
    events.push({ id, actor, action, ts: Math.round(ts), precision: "ms", text, target, tags: tags?.length ? tags : undefined });
    return id;
  };
  const addActor = (id: string, label: string, createdAt: number, digits: boolean) => {
    actors.push({ id, platform: "sim", handle: handle(r, digits), createdAt, followers: Math.round(Math.exp(gauss(r, 5, 1.5))) });
    truth[id] = label;
  };
  const o = scenario.organic;
  const organic = Array.from({ length: o.actors }, (_, i) => `a${i + 1}`);
  organic.forEach((id) => addActor(id, "organic", Date.UTC(2009, 0, 1) + r() * (Date.UTC(2025, 11, 31) - Date.UTC(2009, 0, 1)), r() < 0.15));
  const hubPosts: { id: string; ts: number }[] = [];
  for (const hub of organic.slice(0, o.hubs))
    for (let k = 0; k < 4; k++) {
      const ts = t0 + r() * span;
      const topic = pick(r, scenario.topics);
      hubPosts.push({ id: emit(hub, "post", ts, mutate(pick(r, topic.texts), r, 0.3, scenario.fillers), undefined, topic.tags), ts });
    }
  hubPosts.sort((a, b) => a.ts - b.ts);
  const targetBefore = (ts: number) => {
    const xs = hubPosts.filter((p) => p.ts < ts);
    return xs.length ? xs[Math.floor(Math.pow(r(), 2) * xs.length)].id : undefined;
  };
  for (const a of organic.slice(o.hubs)) {
    const n = Math.max(1, Math.round(expo(r, o.eventsPerActor)));
    for (let k = 0; k < n; k++) {
      const ts = t0 + r() * span;
      const onNarrative = r() < o.narrativeShare;
      const nar = pick(r, scenario.narratives);
      const topic = pick(r, scenario.topics);
      const text = mutate(pick(r, onNarrative ? nar.organicTakes : topic.texts), r, 0.3, scenario.fillers);
      const tags = r() < 0.25 ? (onNarrative ? nar.tags.slice(0, 1) : topic.tags) : undefined;
      const target = r() < 0.55 ? targetBefore(ts) : undefined;
      emit(a, target ? (r() < 0.85 ? "reply" : "quote") : "post", ts, text, target, tags);
    }
  }
  if (scenario.viral) {
    const v = scenario.viral;
    const at = t0 + v.atMin * 60000;
    const viralPost = emit(organic[0], "post", at, v.texts[0], undefined, v.tags);
    const crowd = shuffle(r, organic.slice(o.hubs)).slice(0, v.size);
    for (const a of crowd) {
      truth[a] = "organic:viral";
      emit(a, r() < 0.8 ? "reply" : "quote", at + Math.exp(gauss(r, Math.log(240000), 0.8)), mutate(pick(r, v.texts), r, 0.7, scenario.fillers), viralPost, r() < 0.6 ? v.tags : undefined);
    }
  }
  for (const op of scenario.operations) {
    const nar = scenario.narratives.find((n) => n.id === op.narrative) ?? scenario.narratives[0];
    const members = Array.from({ length: op.size }, (_, i) => `${op.id}_${i + 1}`);
    const batch = t0 - (30 + r() * 300) * DAY;
    members.forEach((m) =>
      addActor(
        m,
        `op:${op.id}:${op.kind}`,
        op.kind === "botfarm" ? batch + r() * 3600000 : op.kind === "swarm" ? t0 - (5 + r() * 25) * DAY : Date.UTC(2012, 0, 1) + r() * 11 * 365 * DAY,
        op.kind === "botfarm",
      ),
    );
    const waveTimes = Array.from({ length: op.waves }, (_, i) => t0 + ((i + 0.2 + r() * 0.6) / op.waves) * span * 0.9).sort((a, b) => a - b);
    for (const m of members.slice(0, op.size >> 1))
      for (let k = 0; k < 2; k++) {
        const topic = pick(r, scenario.topics);
        emit(m, "post", t0 + r() * span, mutate(pick(r, topic.texts), r, 0.6, scenario.fillers));
      }
    for (const T of waveTimes) {
      const seed = emit(members[0], "post", T, mutate(pick(r, nar.claims), r, 0.2, scenario.fillers), undefined, nar.tags);
      const target = r() < 0.5 ? seed : (targetBefore(T) ?? seed);
      if (op.kind === "botfarm") {
        const text = pick(r, nar.claims);
        members.slice(1).forEach((m, i) =>
          emit(m, "reply", T + 20000 + i * 30000 + gauss(r, 0, 2500), `${text} ${pick(r, scenario.fillers.emoji)}`, target, nar.tags),
        );
      } else if (op.kind === "slowswarm") {
        for (const m of members.slice(1)) {
          if (r() < 0.4) continue;
          const text = nar.paraphrases?.length ? mutate(pick(r, nar.paraphrases), r, 0.3, scenario.fillers) : mutate(pick(r, nar.claims), r, 0.95, scenario.fillers);
          emit(m, r() < 0.75 ? "reply" : "quote", T + Math.exp(gauss(r, Math.log(span * 0.2), 0.9)), text, target);
        }
      } else if (op.kind === "paid") {
        for (const m of members.slice(1)) {
          if (r() < 0.15) continue;
          emit(m, r() < 0.8 ? "reply" : "quote", T + Math.exp(gauss(r, Math.log(180000), 0.7)), mutate(pick(r, nar.claims), r, 0.5, scenario.fillers), target, r() < 0.7 ? nar.tags : undefined);
        }
      } else {
        const ids: string[] = [];
        for (const m of members.slice(1)) {
          if (r() < 0.2) continue;
          const reciprocal = ids.length && r() < 0.3 ? pick(r, ids) : target;
          ids.push(emit(m, r() < 0.7 ? "reply" : "post", T + Math.exp(gauss(r, Math.log(600000), 0.9)), (nar.paraphrases?.length ? mutate(pick(r, nar.paraphrases), r, 0.1, scenario.fillers) : mutate(pick(r, nar.claims), r, 0.95, scenario.fillers)), r() < 0.85 ? reciprocal : undefined, r() < 0.3 ? nar.tags : undefined));
        }
      }
    }
  }
  events.sort((a, b) => a.ts - b.ts);
  return { version: SCHEMA_VERSION, actors, events, truth, meta: { source: `simulasi:${scenario.name}`, coverage: 1 } };
}

export async function generateScenario(reasoner: Reasoner, theme: string, base: Scenario): Promise<Scenario> {
  const prompt = [
    `Buat skenario SIMULASI fiktif operasi pengaruh di media sosial Indonesia dengan tema: "${theme}".`,
    "Balas HANYA JSON dengan bentuk:",
    `{"topics":[{"texts":[string x8],"tags":[string]}] x4, "narratives":[{"id":string,"claims":[string x6],"organicTakes":[string x6],"tags":[string]}] x2, "viral":{"texts":[string x8],"tags":[string]}, "fillers":{"openers":[string x6],"closers":[string x6],"emoji":[string x6]}}`,
    "Gunakan gaya bahasa media sosial Indonesia yang realistis dan beragam. Semua nama tempat/tokoh harus fiktif. claims = pesan yang didorong operasi; organicTakes = tanggapan warga biasa (skeptis/netral) terhadap isu yang sama.",
  ].join("\n");
  const raw = await reasoner.complete(prompt, { json: true });
  const g = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  const narratives = g.narratives ?? base.narratives;
  return {
    ...base,
    name: theme,
    topics: g.topics ?? base.topics,
    narratives,
    viral: base.viral && g.viral ? { ...base.viral, texts: g.viral.texts, tags: g.viral.tags } : base.viral,
    fillers: g.fillers ?? base.fillers,
    operations: base.operations.map((op, i) => ({ ...op, narrative: narratives[i % narratives.length].id })),
  };
}

async function pool(reasoner: Reasoner, instruction: string, examples: string[], count: number): Promise<string[]> {
  const prompt = [
    instruction,
    `Contoh:\n${examples.slice(0, 4).map((e) => `- ${e}`).join("\n")}`,
    `Tulis ${count} unggahan media sosial Indonesia yang BERBEDA-BEDA: variasikan persona (umur, daerah, profesi), panjang, gaya (formal, santai, gaul, emosional), dan struktur kalimat. Jangan mengulang frasa pembuka yang sama. Semua nama tempat/tokoh tetap fiktif seperti contoh.`,
    'Balas HANYA JSON: {"posts": [string, ...]}',
  ].join("\n\n");
  const raw = await reasoner.complete(prompt, { json: true });
  const posts: unknown = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)).posts;
  const valid = Array.isArray(posts) ? posts.filter((x): x is string => typeof x === "string" && x.length > 10) : [];
  return valid.length >= count / 3 ? valid : [];
}

export async function enrichScenario(reasoner: Reasoner, scenario: Scenario, count = 30): Promise<Scenario> {
  const [topics, narratives, viral] = await Promise.all([
    Promise.all(scenario.topics.map(async (t) => ({ ...t, texts: [...t.texts, ...(await pool(reasoner, "Buat unggahan warga biasa tentang topik berikut.", t.texts, count))] }))),
    Promise.all(
      scenario.narratives.map(async (n) => ({
        ...n,
        organicTakes: [...n.organicTakes, ...(await pool(reasoner, "Buat tanggapan warga biasa (skeptis, bertanya, netral, atau menolak) terhadap isu berikut.", n.organicTakes, count))],
        paraphrases: await pool(reasoner, "Buat parafrase yang mempertahankan MAKNA dan ajakan pesan berikut, seolah ditulis banyak akun berbeda.", n.claims, count),
      })),
    ),
    scenario.viral ? pool(reasoner, "Buat reaksi spontan warga terhadap momen viral berikut.", scenario.viral.texts, count) : Promise.resolve([]),
  ]);
  return { ...scenario, topics, narratives, viral: scenario.viral ? { ...scenario.viral, texts: [...scenario.viral.texts, ...viral] } : undefined };
}
