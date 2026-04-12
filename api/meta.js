export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  try {
    const url = "http://everest.servercast.com.br:1290/7.html?t=" + Date.now();
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000)
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

    res.status(200).json({ artista, titulo });

  } catch (e) {
    res.status(200).json({ artista: "", titulo: "" });
  }
}
