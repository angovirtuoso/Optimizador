export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  const APPS_SCRIPT_EXEC_URL =
    "https://script.google.com/macros/s/AKfycbxdV6PChDIr1jeGn-DLmS4VrTlEOw1ANH_nyTFMhBS8CbS-ca1PmjIPH2V5SV9kDR9j/exec";

  try {
    const payload = req.body || {};
    const bodyText = JSON.stringify(payload);

    // 1) Primer request al /exec SIN seguir redirects automáticamente
    const firstResponse = await fetch(APPS_SCRIPT_EXEC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: bodyText,
      redirect: "manual"
    });

    let finalResponse = firstResponse;

    // 2) Si Google responde con redirect, seguimos manualmente
    if (
      firstResponse.status >= 300 &&
      firstResponse.status < 400
    ) {
      const location = firstResponse.headers.get("location");

      if (!location) {
        return res.status(502).json({
          ok: false,
          error: "Apps Script respondió con redirect sin Location header"
        });
      }

      // 3) Reenviamos el MISMO POST a la URL final
      finalResponse = await fetch(location, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: bodyText,
        redirect: "manual"
      });
    }

    const text = await finalResponse.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      return res.status(502).json({
        ok: false,
        error: "Respuesta inválida desde Apps Script",
        status: finalResponse.status,
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