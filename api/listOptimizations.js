import { readSheetObjects, normalizeKey, normalizeNumber } from "./_lib.js";

function getField(row, wantedName) {
  if (!row) return "";
  if (row[wantedName] !== undefined) return row[wantedName];

  const wanted = normalizeKey(wantedName);
  const key = Object.keys(row).find((k) => normalizeKey(k) === wanted);

  return key ? row[key] : "";
}

function uniqueClean(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    )
  );
}

function splitEtiqueta(etiqueta) {
  const text = String(etiqueta || "").trim();

  if (!text) return { modelo: "", cliente: "" };

  // Formato común de la app: "MODELO - CLIENTE"
  const parts = text
    .split(" - ")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      modelo: parts.slice(0, -1).join(" - "),
      cliente: parts[parts.length - 1],
    };
  }

  return { modelo: text, cliente: "" };
}

function summarizeOptimization(row) {
  const folioFromRow = String(getField(row, "Folio") || "").trim();
  const nameFromRow = String(getField(row, "Nombre_Optimizacion") || "").trim();
  const notesFromRow = String(getField(row, "Notas") || "").trim();
  const fechaFromRow = String(getField(row, "Fecha") || "").trim();
  const payloadRaw = String(getField(row, "Payload_JSON") || "").trim();

  let payload = null;
  let parseError = "";

  if (payloadRaw) {
    try {
      payload = JSON.parse(payloadRaw);
    } catch (error) {
      parseError = "Payload_JSON inválido";
    }
  }

  const parts = Array.isArray(payload?.parts) ? payload.parts : [];
  const sheets = Array.isArray(payload?.sheets) ? payload.sheets : [];
  const summary = payload?.summary || {};

  const clientes = uniqueClean(
    parts.map((p) =>
      p.cliente ||
      p.Cliente ||
      p.customer ||
      p.Customer ||
      splitEtiqueta(p.etiqueta || p.Etiqueta || p.label || p.Modelo || "").cliente
    )
  );

  const modelos = uniqueClean(
    parts.map((p) =>
      p.modelo ||
      p.Modelo ||
      splitEtiqueta(p.etiqueta || p.Etiqueta || p.label || "").modelo ||
      p.etiqueta ||
      p.Etiqueta ||
      ""
    )
  );

  const requestedParts = parts.reduce(
    (acc, p) =>
      acc + Math.max(1, Math.round(normalizeNumber(p.cantidad ?? p.Cantidad ?? 1))),
    0
  );

  const loadedSheets = sheets.reduce(
    (acc, s) =>
      acc + Math.max(1, Math.round(normalizeNumber(s.cantidad ?? s.Cantidad ?? 1))),
    0
  );

  const wasteMm2 = normalizeNumber(summary.waste);

  return {
    folio: String(payload?.folio || folioFromRow || "").trim(),
    name: String(payload?.name || nameFromRow || "Sin nombre").trim(),
    notes: String(payload?.notes || notesFromRow || "").trim(),
    fecha: String(payload?.createdAt || fechaFromRow || "").trim(),
    clientes,
    modelos,
    modelosPreview: modelos.slice(0, 4).join(", "),
    requestedParts,
    placedParts: normalizeNumber(summary.placedParts),
    loadedSheets,
    usedSheets: normalizeNumber(summary.usedSheets),
    yieldLoaded: normalizeNumber(summary.yieldLoaded),
    usedYield: normalizeNumber(summary.usedYield),
    wasteM2: wasteMm2 / 1000000,
    hasPayload: Boolean(payload),
    parseError,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const rows = await readSheetObjects("Optimizaciones");

    const limitRaw = Number(req.query?.limit || 300);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 500)
      : 300;

    const optimizations = rows
      .map(summarizeOptimization)
      .filter((item) => item.folio)
      .sort((a, b) => {
        const da = Date.parse(a.fecha || "") || 0;
        const db = Date.parse(b.fecha || "") || 0;
        return db - da;
      })
      .slice(0, limit);

    return res.status(200).json({
      ok: true,
      count: optimizations.length,
      optimizations,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Error inesperado en listOptimizations",
    });
  }
}