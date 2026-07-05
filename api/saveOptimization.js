import { appendObjectRow, generateFolio, getSheetsClient } from "./_lib.js";

const DATA_SHEET_NAME = "Optimizaciones_Data";
const CHUNK_SIZE = 40000;

function chunkString(text, size = CHUNK_SIZE) {
  const value = String(text || "");
  const chunks = [];

  for (let i = 0; i < value.length; i += size) {
    chunks.push(value.slice(i, i + size));
  }

  return chunks;
}

async function appendPayloadChunks(folio, payloadJson) {
  const { sheets, spreadsheetId } = getSheetsClient();

  const chunks = chunkString(payloadJson, CHUNK_SIZE);

  if (!chunks.length) {
    throw new Error("El payload está vacío; no hay información para guardar.");
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${DATA_SHEET_NAME}!A:C`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: chunks.map((chunk, index) => [folio, index, chunk]),
    },
  });

  return chunks.length;
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

    const payloadJson = JSON.stringify(payload);
    const chunkCount = await appendPayloadChunks(folio, payloadJson);

    const payloadPointer = {
      storage: "chunks",
      sheet: DATA_SHEET_NAME,
      chunks: chunkCount,
      chunkSize: CHUNK_SIZE,
      chars: payloadJson.length,
      version: 2,
    };

    await appendObjectRow("Optimizaciones", {
      Folio: folio,
      Nombre_Optimizacion: name,
      Notas: notes,
      Fecha: timestamp,
      Payload_JSON: JSON.stringify(payloadPointer),
    });

    return res.status(200).json({
      ok: true,
      folio,
      storage: "chunks",
      chunks: chunkCount,
      message: "Optimización guardada correctamente",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Error inesperado en saveOptimization",
    });
  }
}