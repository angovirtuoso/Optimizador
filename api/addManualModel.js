import { appendObjectRow } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const body = req.body || {};

    if (!body.Cliente || !body.Modelo || !body.Material || !body.Espesor) {
      return res.status(400).json({
        ok: false,
        error: "Faltan campos obligatorios del modelo manual",
      });
    }

    const row = {
      Activo: body.Activo ?? "Si",
      Cliente: body.Cliente ?? "",
      Modelo: body.Modelo ?? "",
      Etiqueta: body.Etiqueta ?? `${body.Modelo} - ${body.Cliente}`,
      Familia: body.Familia ?? "",
      Material: body.Material ?? "",
      Espesor: body.Espesor ?? "",
      Forma: body.Forma ?? "",
      Acabado: body.Acabado ?? "",
      Ancho_Final: body.Ancho_Final ?? "",
      Largo_Final: body.Largo_Final ?? "",
      Tolerancia_Final: body.Tolerancia_Final ?? 0,
      Desbaste: body.Desbaste ?? 0,
      Ancho_Corte: body.Ancho_Corte ?? "",
      Largo_Corte: body.Largo_Corte ?? "",
      Trim_Especial: body.Trim_Especial ?? 0,
      Origen: body.Origen ?? "Manual app",
      Notas: body.Notas ?? "",
    };

    await appendObjectRow("Modelos", row);

    return res.status(200).json({
      ok: true,
      message: "Modelo manual guardado correctamente",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Error inesperado en addManualModel",
    });
  }
}