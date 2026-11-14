import { expect, test } from "bun:test";
import { find, parseJson, walk } from "../src/browser";
import { mediaPk, shortcode } from "../src/instagram";
import { facebookUrl } from "../src/facebook";
import { validate } from "../src";

test("instagram shortcode decodes to media id", () => {
  expect(shortcode("https://www.instagram.com/p/DAbCdEfGhIj/?img_index=1")).toBe("DAbCdEfGhIj");
  expect(shortcode("https://www.instagram.com/reel/C1a2B3c4D5e/")).toBe("C1a2B3c4D5e");
  expect(mediaPk("B")).toBe("1");
  expect(mediaPk("BA")).toBe("64");
});

test("facebook json streams parse line by line", () => {
  const rows = parseJson('for (;;);{"a":1}\n{"b":{"__typename":"Story","post_id":"9"}}');
  expect(rows).toHaveLength(2);
  expect([...walk(rows)].some((o) => o.__typename === "Story")).toBe(true);
  expect(find(rows, (o) => (typeof o.post_id === "string" ? o.post_id : undefined))).toBe("9");
});

test("facebook targets normalize to www urls", () => {
  expect(facebookUrl("https://m.facebook.com/nasa/posts/1")).toBe("https://www.facebook.com/nasa/posts/1");
  expect(facebookUrl("nasa")).toBe("https://www.facebook.com/nasa");
  expect(facebookUrl("bukan url")).toBeUndefined();
});

test("meta targets are validated", () => {
  expect(() => validate({ platform: "instagram", kind: "post", target: "bukan post" })).toThrow();
  expect(() => validate({ platform: "instagram", kind: "account", target: "@tni_angkatan_darat" })).not.toThrow();
  expect(() => validate({ platform: "facebook", kind: "account", target: "bukan url" })).toThrow();
});
