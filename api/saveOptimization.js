import { appendObjectRow, generateFolio } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const body = req.body || {};
    const name = String(body.name || "").trim() || "Sin nombre";
    const notes = String(body.notes || "").trim();
    const parts = Array.isArray(body.parts) ? body.parts : [];
    const sheets = Array.isArray(body.sheets) ? body.sheets : [];
    const plans = Array.isArray(body.plans) ? body.plans : [];
    const summary = body.summary || {};

    const folio = generateFolio();
    const timestamp = new Date().toISOString();

    const payload = {
      folio,
      name,
      notes,
      createdAt: timestamp,
      parts,
      sheets,
      plans,
      summary,
    };

    await appendObjectRow("Optimizaciones", {
      Folio: folio,
      Nombre_Optimizacion: name,
      Notas: notes,
      Fecha: timestamp,
      Payload_JSON: JSON.stringify(payload),
    });

    return res.status(200).json({
      ok: true,
      folio,
      message: "Optimización guardada correctamente",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Error inesperado en saveOptimization",
    });
  }
}