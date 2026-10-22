import assert from "node:assert/strict";
import test from "node:test";

test("renders Renova production metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<title>Renova Store — Everyday finds, renewed\.<\/title>/i);
  assert.match(
    html,
    /<link(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']https:\/\/shoprenova\.com\.ng\/["'])[^>]*>/i,
  );
  assert.match(
    html,
    /<meta(?=[^>]*\bname=["']viewport["'])(?=[^>]*\bcontent=["']width=device-width, initial-scale=1["'])[^>]*>/i,
  );
  assert.match(html, /Lagos: 3–5 working days/);
  assert.match(html, /Outside Lagos: 3–12 working days/);
  for (const path of ["/delivery", "/products/aura-quietmax-wireless-headphones"]) {
    const page = await worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
    assert.equal(page.status, 200, path);
    const content = await page.text();
    assert.match(content, /3–5 working days within Lagos/, path);
    assert.match(content, /3–12 working days outside Lagos/, path);
    assert.doesNotMatch(content, /3–7 working days/, path);
  }

});
