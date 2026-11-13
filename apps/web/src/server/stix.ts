import { uuidFrom } from "cakranala";
import { caseView, snapshot } from "./analysis";
import { store } from "./db";
import { DISARM_SOURCE } from "./disarm";

const iso = (ts: number) => new Date(ts).toISOString();
const sid = (type: string, key: string) => `${type}--${uuidFrom(`${type}:${key}`)}`;

export function stixBundle(caseId: string) {
  const c = caseView(caseId);
  const { report, window } = snapshot();
  if (!c || !report) throw new Error("case is not active in the current analysis window");
  const now = iso(Date.now());
  const common = { spec_version: "2.1", created: now, modified: now };
  const identity = { type: "identity", id: sid("identity", "cakranala"), ...common, name: "Cakra Nala", identity_class: "system" };
  const campaign = {
    type: "campaign",
    id: `campaign--${c.id}`,
    ...common,
    created_by_ref: identity.id,
    name: c.title,
    description: c.brief ?? undefined,
    first_seen: iso(c.firstSeen),
    last_seen: iso(c.lastSeen),
    objective: `Inflate apparent support: ${c.apparent} accounts, about ${c.independent.toFixed(1)} independent voices`,
  };
  const objects: Record<string, unknown>[] = [identity, campaign];
  for (const t of c.disarm) {
    objects.push({ type: "attack-pattern", id: t.stix, ...common, name: t.name, external_references: [{ source_name: "DISARM", external_id: t.id, url: t.url, description: DISARM_SOURCE }] });
    objects.push({ type: "relationship", id: sid("relationship", `${c.id}:${t.id}`), ...common, created_by_ref: identity.id, relationship_type: "uses", source_ref: campaign.id, target_ref: t.stix });
  }
  for (const k of report.clusters.filter((x) => c.clusters.includes(x.id))) {
    const accounts = k.members.map((m) => ({ type: "user-account", spec_version: "2.1", id: sid("user-account", m), user_id: m, account_type: "social-media" }));
    const posts = store.rows(k.members, window.from).length;
    const observed = {
      type: "observed-data",
      id: sid("observed-data", k.id),
      ...common,
      created_by_ref: identity.id,
      first_observed: iso(Math.min(k.forensics.onset.ts, c.lastSeen)),
      last_observed: iso(c.lastSeen),
      number_observed: Math.max(1, posts),
      object_refs: accounts.map((a) => a.id),
      labels: [`cluster-p:${k.p.toFixed(3)}`, `dependence:${k.rho.toFixed(2)}`],
    };
    const relation = { type: "relationship", id: sid("relationship", `${k.id}:${c.id}`), ...common, created_by_ref: identity.id, relationship_type: "related-to", source_ref: observed.id, target_ref: campaign.id };
    objects.push(...accounts, observed, relation);
  }
  return { type: "bundle", id: sid("bundle", `${c.id}:${now}`), objects };
}
