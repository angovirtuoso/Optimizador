import { readSheetObjects, normalizeKey, normalizeNumber } from "./_lib.js";

const DATA_SHEET_NAME = "Optimizaciones_Data";

function getField(row, wantedName) {
  if (!row) return "";

  if (row[wantedName] !== undefined) return row[wantedName];

  const wanted = normalizeKey(wantedName);
  const key = Object.keys(row).find((k) => normalizeKey(k) === wanted);

  return key ? row[key] : "";
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(String(text || ""));
  } catch {
    return null;
  }
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

function buildChunksByFolio(dataRows = []) {
  const map = new Map();

  dataRows.forEach((row) => {
    const folio = String(getField(row, "Folio") || "").trim();
    const chunk = String(getField(row, "Payload_Chunk") || "");

    if (!folio || !chunk) return;

    if (!map.has(folio)) map.set(folio, []);

    map.get(folio).push({
      index: normalizeNumber(getField(row, "Chunk_Index")),
      chunk,
    });
  });

  for (const [folio, chunks] of map.entries()) {
    chunks.sort((a, b) => a.index - b.index);
    map.set(
      folio,
      chunks.map((item) => item.chunk).join("")
    );
  }

  return map;
}

function getPayloadFromRow(row, chunksByFolio) {
  const folioFromRow = String(getField(row, "Folio") || "").trim();
  const payloadRaw = String(getField(row, "Payload_JSON") || "").trim();

  if (!payloadRaw) {
    return {
      payload: null,
      storage: "empty",
      parseError: "Sin Payload_JSON",
    };
  }

  const parsed = parseJsonSafe(payloadRaw);

  if (!parsed) {
    return {
      payload: null,
      storage: "invalid",
      parseError: "Payload_JSON inválido",
    };
  }

  if (parsed.storage === "chunks") {
    const chunkPayloadRaw = chunksByFolio.get(folioFromRow);

    if (!chunkPayloadRaw) {
      return {
        payload: null,
        storage: "chunks",
        parseError: `No se encontraron chunks para ${folioFromRow}`,
      };
    }

    const chunkPayload = parseJsonSafe(chunkPayloadRaw);

    if (!chunkPayload) {
      return {
        payload: null,
        storage: "chunks",
        parseError: `Chunks corruptos para ${folioFromRow}`,
      };
    }

    return {
      payload: chunkPayload,
      storage: "chunks",
      parseError: "",
    };
  }

  return {
    payload: parsed,
    storage: "single_cell",
    parseError: "",
  };
}

function summarizeOptimization(row, chunksByFolio) {
  const folioFromRow = String(getField(row, "Folio") || "").trim();
  const nameFromRow = String(getField(row, "Nombre_Optimizacion") || "").trim();
  const notesFromRow = String(getField(row, "Notas") || "").trim();
  const fechaFromRow = String(getField(row, "Fecha") || "").trim();

  const payloadResult = getPayloadFromRow(row, chunksByFolio);
  const payload = payloadResult.payload;

  const parts = Array.isArray(payload?.parts) ? payload.parts : [];
  const sheets = Array.isArray(payload?.sheets) ? payload.sheets : [];
  const summary = payload?.summary || {};

  const clientes = uniqueClean(
    parts.map((p) => {
      const etiqueta = p.etiqueta || p.Etiqueta || p.label || p.Modelo || "";
      return (
        p.cliente ||
        p.Cliente ||
        p.customer ||
        p.Customer ||
        splitEtiqueta(etiqueta).cliente
      );
    })
  );

  const modelos = uniqueClean(
    parts.map((p) => {
      const etiqueta = p.etiqueta || p.Etiqueta || p.label || "";
      return (
        p.modelo ||
        p.Modelo ||
        splitEtiqueta(etiqueta).modelo ||
        etiqueta ||
        ""
      );
    })
  );

  const requestedParts = parts.reduce((acc, p) => {
    return (
      acc +
      Math.max(
        1,
        Math.round(normalizeNumber(p.cantidad ?? p.Cantidad ?? 1))
      )
    );
  }, 0);

  const loadedSheets = sheets.reduce((acc, s) => {
    return (
      acc +
      Math.max(
        1,
        Math.round(normalizeNumber(s.cantidad ?? s.Cantidad ?? 1))
      )
    );
  }, 0);

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

    storage: payloadResult.storage,
    hasPayload: Boolean(payload),
    parseError: payloadResult.parseError,
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

    let dataRows = [];
    try {
      dataRows = await readSheetObjects(DATA_SHEET_NAME);
    } catch {
      dataRows = [];
    }

    const chunksByFolio = buildChunksByFolio(dataRows);

    const limitRaw = Number(req.query?.limit || 300);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 500)
      : 300;

    const optimizations = rows
      .map((row) => summarizeOptimization(row, chunksByFolio))
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