import type { Actor } from "cakranala";
import { audit, db } from "./db";
import { open, seal } from "./vault";

db.exec("CREATE TABLE IF NOT EXISTS identities (pseudonym TEXT PRIMARY KEY, platform TEXT NOT NULL, secret TEXT NOT NULL, iv TEXT NOT NULL, created_at INTEGER NOT NULL)");

export interface Identity {
  platform: string;
  id: string;
  handle: string;
}

const exists = db.query("SELECT 1 FROM identities WHERE pseudonym = ?");
const insert = db.query("INSERT OR IGNORE INTO identities (pseudonym, platform, secret, iv, created_at) VALUES (?, ?, ?, ?, ?)");

export const identities = {
  async put(actors: Actor[], ids: Map<string, string>) {
    const rows: [string, string, string, string][] = [];
    for (const a of actors) {
      const pseudonym = ids.get(a.id);
      if (!pseudonym || exists.get(pseudonym)) continue;
      const { secret, iv } = await seal({ id: a.id, handle: a.handle ?? "" });
      rows.push([pseudonym, a.platform, secret, iv]);
    }
    const now = Date.now();
    db.transaction(() => rows.forEach((r) => insert.run(...r, now)))();
    return rows.length;
  },
  known: (pseudonyms: string[]) => new Set(pseudonyms.filter((p) => exists.get(p))),
  async reveal(pseudonym: string, by: string, caseId: string): Promise<Identity | undefined> {
    const r = db.query("SELECT platform, secret, iv FROM identities WHERE pseudonym = ?").get(pseudonym) as { platform: string; secret: string; iv: string } | null;
    if (!r) return undefined;
    const f = await open(r.secret, r.iv);
    audit.add("identity.revealed", pseudonym, { caseId, by, platform: r.platform });
    return { platform: r.platform, id: f.id, handle: f.handle };
  },
};
