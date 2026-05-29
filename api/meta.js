export default async function handler(req, res) {
  // ── CORS restrito ao próprio domínio ──────────────────────────────────────
  const allowedOrigins = process.env.ALLOWED_ORIGIN
    ? process.env.ALLOWED_ORIGIN.split(",").map(o => o.trim())
    : [];

  const origin = req.headers.origin || "";
  if (allowedOrigins.length === 0 || !origin || allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else {
    return res.status(403).json({ error: "Origem não permitida" });
  }

  res.setHeader("Cache-Control", "no-store");

  // ── Apenas GET é aceito ───────────────────────────────────────────────────
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // ── Busca metadados do stream ─────────────────────────────────────────────
  try {
    const streamUrl =
      "http://everest.servercast.com.br:1290/7.html?t=" + Date.now();

    const response = await fetch(streamUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return res.status(502).json({ error: "Servidor indisponível" });
    }

    const html = await response.text();
    const match = html.match(/<body[^>]*>(.*?)<\/body>/i);

    if (!match) {
      return res.status(200).json({ artista: "", titulo: "" });
    }

    const parts = match[1].trim().split(",");
    const raw = parts.length >= 7 ? parts[6].trim() : "";

    let artista = "";
    let titulo = raw;

    if (raw.includes(" - ")) {
      const idx = raw.indexOf(" - ");
      artista = raw.substring(0, idx).trim();
      titulo  = raw.substring(idx + 3).trim();
    }

    // ── Busca capa via Last.fm no servidor (chave nunca vai ao cliente) ──────
    const lastfmKey = process.env.LASTFM_API_KEY || "";
    let capaUrl = "";

    if (lastfmKey && artista && titulo) {
      try {
        const principal = artista.split(/\s+[Ff][Tt]\.?\s+/)[0].trim();
        const lfmUrl =
          "https://ws.audioscrobbler.com/2.0/?method=track.getInfo" +
          "&api_key=" + lastfmKey +
          "&artist=" + encodeURIComponent(principal) +
          "&track="  + encodeURIComponent(titulo) +
          "&format=json";

        const lfmRes  = await fetch(lfmUrl);
        const lfmData = await lfmRes.json();
        const images  = lfmData?.track?.album?.image;

        if (images) {
          const extra = images.find(i => i.size === "extralarge");
          if (extra?.["#text"]) capaUrl = extra["#text"];
        }
      } catch (lfmErr) {
        console.error("[meta] Last.fm error:", lfmErr);
      }
    }

    return res.status(200).json({ artista, titulo, capaUrl });

  } catch (e) {
    console.error("[meta] Upstream error:", e);
    return res.status(200).json({ artista: "", titulo: "" });
  }
}
