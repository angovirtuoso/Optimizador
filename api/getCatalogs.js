import { google } from "googleapis";

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error("Faltan variables de entorno de Google");
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  return {
    auth: new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
      ],
    }),
    spreadsheetId,
  };
}

function rowsToObjects(values = []) {
  if (!values.length) return [];
  const headers = values[0].map((h) => String(h || "").trim());

  return values
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
    .map((row) => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] ?? "";
      });
      return obj;
    });
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const { auth, spreadsheetId } = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [
        "Modelos!A:Q",
        "Material!A:A",
        "Espesor!A:A",
        "Laminas!A:C",
        "Acabados!A:B",
      ],
    });

    const ranges = response.data.valueRanges || [];

    const modelosRows = rowsToObjects(ranges[0]?.values || []);
    const materialRows = rowsToObjects(ranges[1]?.values || []);
    const espesorRows = rowsToObjects(ranges[2]?.values || []);
    const laminasRows = rowsToObjects(ranges[3]?.values || []);
    const acabadosRows = rowsToObjects(ranges[4]?.values || []);

    const modelos = modelosRows
      .filter((r) =>
        ["SI", "Sí", "si", "1", "TRUE", "true"].includes(
          String(r.Activo || "").trim()
        )
      )
      .map((r) => ({
        Activo: String(r.Activo || "").trim(),
        Cliente: String(r.Cliente || "").trim(),
        Modelo: String(r.Modelo || "").trim(),
        Etiqueta:
          String(r.Etiqueta || "").trim() ||
          `${String(r.Modelo || "").trim()} - ${String(r.Cliente || "").trim()}`,
        Familia: String(r.Familia || "").trim(),
        Material: String(r.Material || "").trim(),
        Espesor: String(r.Espesor || "").trim(),
        Forma: String(r.Forma || "").trim(),
        Acabado: String(r.Acabado || "").trim(),
        Ancho_Final: normalizeNumber(r.Ancho_Final),
        Largo_Final: normalizeNumber(r.Largo_Final),
        Tolerancia_Final: normalizeNumber(r.Tolerancia_Final),
        Desbaste: normalizeNumber(r.Desbaste),
        Ancho_Corte: normalizeNumber(r.Ancho_Corte),
        Largo_Corte: normalizeNumber(r.Largo_Corte),
        Trim_Especial: normalizeNumber(r.Trim_Especial),
        Origen: String(r.Origen || "").trim(),
        Notas: String(r.Notas || "").trim(),
      }));

    const materiales = materialRows
      .map((r) => String(r.Material || "").trim())
      .filter(Boolean);

    const espesores = espesorRows
      .map((r) => String(r.Espesor || "").trim())
      .filter(Boolean);

    const laminas = laminasRows.map((r) => ({
      Etiqueta: String(r.Etiqueta || "").trim(),
      Ancho: normalizeNumber(r.Ancho),
      Largo: normalizeNumber(r.Largo),
    }));

    const acabados = acabadosRows.map((r) => ({
      Acabado: String(r.Acabado || "").trim(),
      Descripcion: String(r.Descripcion || "").trim(),
    }));

    return res.status(200).json({
      ok: true,
      catalogs: {
        modelos,
        materiales,
        espesores,
        laminas,
        acabados,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Error inesperado en getCatalogs",
    });
  }
}