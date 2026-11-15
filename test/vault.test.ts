import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pseudonymize, pseudonyms, simulate, type Scenario } from "../src";
import scenario from "../scenarios/seruni.json";

process.env.CAKRANALA_DATA = mkdtempSync(join(tmpdir(), "cakranala-test-"));
const { open, seal } = await import("../web/src/server/vault");
const { identities } = await import("../web/src/server/identities");
const { audit } = await import("../web/src/server/db");

test("vault seal dan open kembali ke isi semula", async () => {
  const sealed = await seal({ a: "1", b: "rahasia" });
  expect(sealed.secret).not.toContain("rahasia");
  expect(await open(sealed.secret, sealed.iv)).toEqual({ a: "1", b: "rahasia" });
});

test("identitas tersimpan terenkripsi dan hanya terbuka lewat reveal yang tercatat di audit", async () => {
  const ds = simulate(scenario as Scenario, 1);
  const ids = await pseudonyms(ds, "rahasia");
  const p = await pseudonymize(ds, "rahasia", ids);
  expect(p.actors.map((a) => a.id)).toEqual((await pseudonymize(ds, "rahasia")).actors.map((a) => a.id));
  expect(await identities.put(ds.actors.slice(0, 3), ids)).toBe(3);
  expect(await identities.put(ds.actors.slice(0, 3), ids)).toBe(0);
  const pseudonym = ids.get(ds.actors[0].id)!;
  expect(identities.known([pseudonym, "akun_tidakada"])).toEqual(new Set([pseudonym]));
  const before = audit.of(pseudonym).length;
  const who = await identities.reveal(pseudonym, "analis", "kasus-1");
  expect(who).toEqual({ platform: ds.actors[0].platform, id: ds.actors[0].id, handle: ds.actors[0].handle ?? "" });
  expect(audit.of(pseudonym).length).toBe(before + 1);
  expect(audit.of(pseudonym).at(-1)!.action).toBe("identity.revealed");
  expect(await identities.reveal("akun_tidakada", "analis", "kasus-1")).toBeUndefined();
});
