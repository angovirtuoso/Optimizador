export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxdV6PChDIr1jeGn-DLmS4VrTlEOw1ANH_nyTFMhBS8CbS-ca1PmjIPH2V5SV9kDR9j/exec";

  try {
    const payload = req.body || {};

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      return res.status(502).json({
        ok: false,
        error: "Respuesta inválida desde Apps Script",
        raw: text
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Error inesperado en proxy"
    });
  }
}