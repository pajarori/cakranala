import type { Event } from "../../engine";
import type { Platform } from "../index";
import { mediaCode } from "../instagram";

export interface Identity {
  platform: string;
  id: string;
  handle: string;
}

const bare = (id: string) => id.slice(id.indexOf(":") + 1);
const handleOf = (h: string) => h.replace(/^@/, "");

export function profileUrl(who: Identity): string | undefined {
  const id = bare(who.id);
  const handle = handleOf(who.handle);
  switch (who.platform as Platform) {
    case "x":
      return `https://x.com/i/user/${id}`;
    case "instagram":
      return handle ? `https://www.instagram.com/${handle}/` : undefined;
    case "facebook":
      return `https://www.facebook.com/${id}`;
    case "tiktok":
      return handle ? `https://www.tiktok.com/@${handle}` : undefined;
    case "youtube":
      return `https://www.youtube.com/channel/${id}`;
    case "telegram":
      return `https://t.me/${handle || id}`;
  }
  return undefined;
}

const parse = (ref?: string) => ref?.match(/(?:^|:)(x|tg|ig|fb|yt|tt):(.+)$/)?.slice(1) as [string, string] | undefined;

export function permalink(e: Pick<Event, "id" | "action" | "target">, who?: Identity): string | undefined {
  const [platform, id] = parse(e.id) ?? ["", ""];
  const target = parse(e.target);
  const own = e.action === "post" || e.action === "reshare" || e.action === "quote";
  switch (platform) {
    case "x":
      return /^\d+$/.test(id) ? `https://x.com/i/status/${id}` : undefined;
    case "tg":
      return /^[\w]+\/\d+$/.test(id) ? `https://t.me/${id}` : undefined;
    case "ig":
      return own && /^\d+$/.test(id) ? `https://www.instagram.com/p/${mediaCode(id)}/` : undefined;
    case "fb":
      return own && /^\d+$/.test(id) ? `https://www.facebook.com/${id}` : undefined;
    case "yt":
      return target?.[0] === "yt" ? `https://www.youtube.com/watch?v=${target[1]}&lc=${id}` : undefined;
    case "tt":
      return own && who?.handle ? `https://www.tiktok.com/@${handleOf(who.handle)}/video/${id}` : undefined;
  }
  return undefined;
}
