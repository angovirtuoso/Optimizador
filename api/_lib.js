import { google } from "googleapis";

export function getAuthConfig() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error("Faltan variables de entorno de Google");
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  return { auth, spreadsheetId };
}

export function getSheetsClient() {
  const { auth, spreadsheetId } = getAuthConfig();
  const sheets = google.sheets({ version: "v4", auth });
  return { sheets, spreadsheetId };
}

export async function getSheetHeaders(sheetName) {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });
  return (res.data.values?.[0] || []).map((h) => String(h || "").trim());
}

export async function readSheetObjects(sheetName) {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:ZZ`,
  });

  const values = res.data.values || [];
  if (!values.length) return [];

  const headers = values[0].map((h) => String(h || "").trim());

  return values
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
    .map((row, rowIndex) => {
      const obj = { _rowNumber: rowIndex + 2 };
      headers.forEach((header, i) => {
        obj[header] = row[i] ?? "";
      });
      return obj;
    });
}

export async function appendObjectRow(sheetName, objectData) {
  const { sheets, spreadsheetId } = getSheetsClient();
  const headers = await getSheetHeaders(sheetName);

  if (!headers.length) {
    throw new Error(`La hoja ${sheetName} no tiene encabezados`);
  }

  const row = headers.map((header) => {
    const exact = objectData[header];
    if (exact !== undefined) return exact;

    const normalizedHeader = normalizeKey(header);
    const foundKey = Object.keys(objectData).find(
      (k) => normalizeKey(k) === normalizedHeader
    );

    return foundKey ? objectData[foundKey] : "";
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row],
    },
  });
}

export function normalizeKey(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

export function generateFolio() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `OPT-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${ms}`;
}