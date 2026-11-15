import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { DIR } from "./db";

const KEY_FILE = `${DIR}credential.key`;

function keyBytes() {
  if (!existsSync(KEY_FILE)) {
    writeFileSync(KEY_FILE, Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64"), { mode: 0o600 });
    chmodSync(KEY_FILE, 0o600);
  }
  return Buffer.from(readFileSync(KEY_FILE, "utf8").trim(), "base64");
}

const key = crypto.subtle.importKey("raw", keyBytes(), "AES-GCM", false, ["encrypt", "decrypt"]);

export async function seal(fields: Record<string, string>) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key, new TextEncoder().encode(JSON.stringify(fields)));
  return { secret: Buffer.from(data).toString("base64"), iv: Buffer.from(iv).toString("base64") };
}

export async function open(secret: string, iv: string): Promise<Record<string, string>> {
  const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64") }, await key, Buffer.from(secret, "base64"));
  return JSON.parse(new TextDecoder().decode(data));
}
