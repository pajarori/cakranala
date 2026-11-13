import { handleShape } from "./detect/layers";
import type { Dataset } from "./schema";

async function hmac(key: CryptoKey, value: string) {
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return Array.from(sig.subarray(0, 5), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function pseudonymize(ds: Dataset, secret: string): Promise<Dataset> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const ids = new Map<string, string>();
  for (const a of ds.actors) ids.set(a.id, `akun_${await hmac(key, a.id)}`);
  const mention = /@\w+/g;
  return {
    ...ds,
    actors: ds.actors.map((a) => ({ ...a, id: ids.get(a.id)!, handle: ids.get(a.id)!, shape: a.shape ?? handleShape(a.handle) })),
    events: ds.events.map((e) => ({ ...e, actor: ids.get(e.actor)!, text: e.text?.replace(mention, "@akun") })),
    truth: ds.truth && Object.fromEntries(Object.entries(ds.truth).map(([k, v]) => [ids.get(k) ?? k, v])),
  };
}
