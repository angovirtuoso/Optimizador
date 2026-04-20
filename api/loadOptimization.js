import { readSheetObjects, normalizeKey } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const body = req.body || {};
    const folio = String(body.folio || "").trim();

    if (!folio) {
      return res.status(400).json({
        ok: false,
        error: "Debes indicar un folio",
      });
    }

    const rows = await readSheetObjects("Optimizaciones");
    const found = rows.find((row) => {
      const rowFolio =
        row.Folio ??
        row[Object.keys(row).find((k) => normalizeKey(k) === "folio")] ??
        "";
      return String(rowFolio).trim() === folio;
    });

    if (!found) {
      return res.status(404).json({
        ok: false,
        error: "No se encontró una optimización con ese folio",
      });
    }

    const payloadRaw =
      found.Payload_JSON ??
      found[Object.keys(found).find((k) => normalizeKey(k) === "payload_json")] ??
      "";

    if (!payloadRaw) {
      return res.status(500).json({
        ok: false,
        error: "La fila encontrada no contiene Payload_JSON",
      });
    }

    let optimization;
    try {
      optimization = JSON.parse(payloadRaw);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "El Payload_JSON está corrupto o no es válido",
      });
    }

    return res.status(200).json({
      ok: true,
      optimization,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Error inesperado en loadOptimization",
    });
  }
}