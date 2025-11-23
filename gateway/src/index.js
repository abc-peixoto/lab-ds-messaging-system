const express = require("express");
const httpProxy = require("http-proxy");
const dns = require("dns").promises;

const app = express();

const proxy = httpProxy.createProxyServer({});

const SERVICE = process.env.UPSTREAM_SERVICE || "list-service";
const PORT = process.env.UPSTREAM_PORT || 3000;

let upstreams = [];
let rrIndex = 0;

async function refreshUpstreams() {
  try {
    const records = await dns.lookup(SERVICE, { all: true });
    upstreams = records.map(r => `http://${r.address}:${PORT}`);
    if (upstreams.length === 0) {
      console.warn("[Gateway] No upstreams found yet.");
    } else {
      console.log("[Gateway] Upstreams:", upstreams);
    }
  } catch (err) {
    console.warn("[Gateway] DNS lookup failed:", err.message);
  }
}

function pickUpstream() {
  if (upstreams.length === 0) return null;
  const target = upstreams[rrIndex % upstreams.length];
  rrIndex++;
  return target;
}

refreshUpstreams();
setInterval(refreshUpstreams, 5000);

function handleProxy(req, res) {
  const first = pickUpstream();
  if (!first) return res.status(503).json({ error: "No upstream available" });

  let tried = new Set([first]);

  const attempt = (target) => {
    proxy.web(req, res, { target }, (err) => {
      console.warn("[Gateway] proxy error ->", err.code || err.message);

      const next = pickUpstream();
      if (!next || tried.has(next)) {
        return res.status(502).json({ error: "Upstream failure" });
      }
      tried.add(next);
      attempt(next);
    });
  };

  attempt(first);
}

app.all("/lists/*", handleProxy);

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(3000, () => {
  console.log("[Gateway] listening on :3000");
});
