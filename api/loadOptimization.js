import { readSheetObjects, normalizeKey, normalizeNumber } from "./_lib.js";

const DATA_SHEET_NAME = "Optimizaciones_Data";

function getField(row, wantedName) {
  if (!row) return "";

  if (row[wantedName] !== undefined) return row[wantedName];

  const wanted = normalizeKey(wantedName);
  const key = Object.keys(row).find((k) => normalizeKey(k) === wanted);

  return key ? row[key] : "";
}

function parseJsonSafe(text, errorMessage) {
  try {
    return JSON.parse(String(text || ""));
  } catch {
    throw new Error(errorMessage);
  }
}

async function loadChunkedPayload(folio, pointer = {}) {
  const sheetName = pointer.sheet || DATA_SHEET_NAME;
  const rows = await readSheetObjects(sheetName);

  const chunks = rows
    .filter((row) => String(getField(row, "Folio") || "").trim() === folio)
    .map((row) => ({
      index: normalizeNumber(getField(row, "Chunk_Index")),
      chunk: String(getField(row, "Payload_Chunk") || ""),
    }))
    .filter((row) => row.chunk !== "")
    .sort((a, b) => a.index - b.index);

  if (!chunks.length) {
    throw new Error(
      `No se encontraron datos de payload para el folio ${folio} en ${sheetName}`
    );
  }

  const expectedChunks = normalizeNumber(pointer.chunks);

  if (expectedChunks > 0 && chunks.length !== expectedChunks) {
    throw new Error(
      `Payload incompleto para ${folio}. Se esperaban ${expectedChunks} partes y se encontraron ${chunks.length}.`
    );
  }

  const payloadRaw = chunks.map((item) => item.chunk).join("");

  return parseJsonSafe(
    payloadRaw,
    "El Payload_JSON dividido en chunks está corrupto o no es válido"
  );
}

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
      const rowFolio = String(getField(row, "Folio") || "").trim();
      return rowFolio === folio;
    });

    if (!found) {
      return res.status(404).json({
        ok: false,
        error: "No se encontró una optimización con ese folio",
      });
    }

    const payloadRaw = String(getField(found, "Payload_JSON") || "").trim();

    if (!payloadRaw) {
      return res.status(500).json({
        ok: false,
        error: "La fila encontrada no contiene Payload_JSON",
      });
    }

    const parsedPayload = parseJsonSafe(
      payloadRaw,
      "El Payload_JSON está corrupto o no es válido"
    );

    let optimization;

    if (parsedPayload?.storage === "chunks") {
      optimization = await loadChunkedPayload(folio, parsedPayload);
    } else {
      optimization = parsedPayload;
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