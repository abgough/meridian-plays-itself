import type { Config } from "@netlify/functions";

// Aircraft around one location, for Sky Sweep.
//
// GET /api/near?lat=<lat>&lon=<lon>  (the page rounds to 0.1°, about 7 miles)
// Fetches everything within 250 nm from adsb.lol, identifying the site properly, and returns compact
// rows with the time of each plane's last known position. Netlify's CDN caches each location for a
// few seconds, so everyone watching the same area shares one request.

const RADIUS_NM = 250;
const USER_AGENT = "SkySweep/2.0 (+https://skysweep-relay.netlify.app)";

// Row: [hex, callsign, type, category, lat, lon, altitude (number | "g" | null), ground speed, track, fix time ms]
type Row = [string, string, string, string, number, number, number | "g" | null, number | null, number | null, number];

const round = (v: unknown, dp: number) => (typeof v === "number" ? Number(v.toFixed(dp)) : null);

export default async (req: Request) => {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!url.searchParams.has("lat") || !url.searchParams.has("lon") || !isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) {
    return Response.json({ error: "bad location" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`https://api.adsb.lol/v2/point/${lat.toFixed(1)}/${lon.toFixed(1)}/${RADIUS_NM}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return Response.json({ error: "feed unreachable" }, { status: 504, headers: { "Cache-Control": "no-store" } });
  }
  if (!res.ok) {
    return Response.json({ error: "feed error", status: res.status }, { status: res.status === 429 ? 429 : 502, headers: { "Cache-Control": "no-store" } });
  }

  const data = await res.json();
  let base = typeof data.now === "number" ? data.now : Date.now();
  if (base < 1e12) base *= 1000;
  const ac: Row[] = [];
  for (const a of data.ac || []) {
    if (typeof a.lat !== "number" || typeof a.lon !== "number" || !a.hex) continue;
    const age = typeof a.seen_pos === "number" ? a.seen_pos : typeof a.seen === "number" ? a.seen : 0;
    const alt = a.alt_baro === "ground" ? "g" : typeof a.alt_baro === "number" ? a.alt_baro : typeof a.alt_geom === "number" ? a.alt_geom : null;
    const track = typeof a.track === "number" ? a.track : typeof a.true_heading === "number" ? a.true_heading : null;
    ac.push([a.hex, String(a.flight || a.r || "").trim(), a.t || "", a.category || "", Number(a.lat.toFixed(4)), Number(a.lon.toFixed(4)), alt, round(a.gs, 0), round(track, 0), Math.round(base - age * 1000)]);
  }

  return Response.json(
    { now: Date.now(), ac },
    {
      headers: {
        "Cache-Control": "no-store",
        "Netlify-CDN-Cache-Control": "public, durable, s-maxage=8, stale-while-revalidate=8",
        "Netlify-Vary": "query=lat|lon",
      },
    }
  );
};

export const config: Config = {
  path: "/api/near",
};
