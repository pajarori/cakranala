import { afterAll, expect, test } from "bun:test";
import { runFlow, type Flow } from "../src/collect/report";

const enabled = !!process.env.CAKRANALA_CHROME_TESTS;

const page = (body: string) => new Response(`<!doctype html><html><body>${body}</body></html>`, { headers: { "content-type": "text/html" } });

const DIALOG = `
<button aria-label="More" onclick="document.getElementById('m').hidden=false">...</button>
<div id="m" hidden role="menu"><div role="menuitem" onclick="document.getElementById('d').hidden=false">Report post</div></div>
<div id="d" hidden role="dialog">
  <label role="radio" onclick="document.getElementById('n').hidden=false">Spam</label>
  <button id="n" hidden onclick="document.body.innerHTML='<p>Thanks for letting us know</p>'">Next</button>
</div>`;

const server = enabled
  ? Bun.serve({
      port: 0,
      fetch: (req) => {
        const path = new URL(req.url).pathname;
        if (path === "/ok") return page(DIALOG);
        if (path === "/captcha") return page(`<iframe src="/recaptcha/api2/anchor"></iframe>${DIALOG}`);
        if (path === "/missing") return page("<p>kosong</p>");
        return page("");
      },
    })
  : undefined;

afterAll(() => server?.stop(true));

const flow: Flow = { steps: [{ click: ["more"] }, { click: ["report post"] }, { click: ["spam"] }, { click: ["next"], optional: true }], done: ["thanks for"] };
const session = { cookie: "", userAgent: "Mozilla/5.0" };

test.skipIf(!enabled)("alur report selesai dan menyimpan screenshot", async () => {
  const r = await runFlow(session, "localhost", `http://localhost:${server!.port}/ok`, flow);
  expect(r.status).toBe("sent");
  expect(r.screenshot!.length).toBeGreaterThan(1000);
}, 60_000);

test.skipIf(!enabled)("captcha menjadi needs_manual", async () => {
  const r = await runFlow(session, "localhost", `http://localhost:${server!.port}/captcha`, flow);
  expect(r.status).toBe("needs_manual");
  expect(r.error).toContain("captcha");
}, 60_000);

test.skipIf(!enabled)("tombol yang hilang menjadi needs_manual dengan screenshot", async () => {
  const r = await runFlow(session, "localhost", `http://localhost:${server!.port}/missing`, flow);
  expect(r.status).toBe("needs_manual");
  expect(r.screenshot).toBeDefined();
}, 60_000);
