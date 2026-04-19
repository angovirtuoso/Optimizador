export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  const APPS_SCRIPT_URL =
    "https://script.googleusercontent.com/macros/echo?user_content_key=AWDtjMV0YL6YBMLnA1UIYHqmaQw1lfZoI3h-yVAMv9E7Qt1uVG6eztb2uJkryRBieOefElxWJMkNmJLL3Dm5vQNovQZ0vTAVfMdLidGq5vYcjJpKBUsUrdeQZxPfiHK58708kYJQ76lKzivXyAjS_s-b1vfBDi-RgeM7ZNOfQULTbLCsXKp4COd3drUIh89hhiEXcBZgtKRM2ZU8-q0HGCBT3PuDWEYGuY7PwLn5nb_JTgvqCqKU4YlZNc6zrX7hDpprvmiYxdQxiWalaB6i7SX2EeQpXBB7Zw&lib=Mo_PpL0cq193QIMYHFekrA0KvG7nEhGPR";

  try {
    const payload = req.body || {};

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
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