// HomeFlix install counter (Cloudflare Worker + KV).
//
// POST /ping  {"id":"<random install id>","v":"5.5.1"}  -> 204
// GET  /stats -> {"installs":N,"active_30d":N,"active_7d":N,"versions":{"5.5.1":N},"updated":"..."}
//
// Stores only the random install id, its version and the day it was last
// seen. No IP addresses, names or library data.
const ID = /^[a-f0-9]{32}$/;
const DAY = 86400000;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type" };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (req.method === "POST" && url.pathname === "/ping") {
      let body;
      try { body = await req.json(); } catch { return new Response("bad json", { status: 400, headers: cors }); }
      const id = String(body.id || "").toLowerCase();
      if (!ID.test(id)) return new Response("bad id", { status: 400, headers: cors });
      const v = String(body.v || "unknown").slice(0, 24).replace(/[^\w.\-+]/g, "");
      // One write per install per day at most (KV free tier: 1000 writes/day).
      const prev = await env.INSTALLS.getWithMetadata("i:" + id);
      const m = prev.metadata;
      if (!m || m.v !== v || Date.now() - m.seen > 20 * 3600000) {
        await env.INSTALLS.put("i:" + id, "1", { metadata: { v, seen: Date.now() } });
      }
      return new Response(null, { status: 204, headers: cors });
    }

    if (req.method === "GET" && url.pathname === "/stats") {
      const cached = await env.INSTALLS.get("stats:cache", "json");
      if (cached && Date.now() - cached.at < 10 * 60000) return json(cached.stats, cors);
      const now = Date.now();
      const s = { installs: 0, active_30d: 0, active_7d: 0, versions: {}, updated: new Date(now).toISOString() };
      let cursor;
      do {
        const page = await env.INSTALLS.list({ prefix: "i:", cursor });
        for (const k of page.keys) {
          const rec = k.metadata; // listed with the key: no extra reads
          if (!rec) continue;
          s.installs++;
          const age = now - rec.seen;
          if (age < 30 * DAY) { s.active_30d++; s.versions[rec.v] = (s.versions[rec.v] || 0) + 1; }
          if (age < 7 * DAY) s.active_7d++;
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      await env.INSTALLS.put("stats:cache", JSON.stringify({ at: now, stats: s }));
      return json(s, cors);
    }
    return new Response("HomeFlix install counter", { headers: cors });
  },
};

function json(o, headers) {
  return new Response(JSON.stringify(o), { headers: { ...headers, "Content-Type": "application/json" } });
}
