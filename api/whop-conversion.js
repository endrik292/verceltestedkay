// Vercel-Adapter fuer die ALTE Whop-Function (Setup vom 03.09., damals auf Netlify).
// appmethode.com laeuft seit 22.10. auf Vercel, wo Netlify-Functions nicht laufen.
// Dieser Adapter ruft die unveraenderte Datei netlify/functions/whop-conversion.js auf,
// damit Logik, Parameter und Whop-Payload 1:1 wie damals bleiben.
//
// URL: https://appmethode.com/api/whop-conversion/  (vercel.json: trailingSlash -> mit Schraegstrich)
// Env (nur in Vercel): WHOP_API_KEY, WHOP_ACCOUNT_ID, CLICKFLARE_POSTBACK_SECRET

const { handler } = require("../netlify/functions/whop-conversion.js");

module.exports = async function vercelAdapter(req, res) {
  const headers = { ...req.headers };

  // Netlify lieferte die Client-IP im Header x-nf-client-connection-ip; auf Vercel steht sie in
  // x-forwarded-for. Wie damals ist das die IP des Aufrufers (bei Postbacks: ClickFlares Server).
  const forwarded = String(headers["x-forwarded-for"] || headers["x-real-ip"] || "").split(",")[0].trim();
  if (forwarded && !headers["x-nf-client-connection-ip"]) headers["x-nf-client-connection-ip"] = forwarded;

  // Body im Netlify-Format: Vercel hat ihn ggf. schon geparst
  let body = null;
  if (typeof req.body === "string") {
    body = req.body;
  } else if (req.body && typeof req.body === "object" && Object.keys(req.body).length) {
    body = JSON.stringify(req.body);
    headers["content-type"] = "application/json";
  }

  const rawQuery = (req.url || "").includes("?") ? req.url.slice(req.url.indexOf("?") + 1) : "";

  const result = await handler({
    httpMethod: req.method,
    rawQuery,
    headers,
    body,
    isBase64Encoded: false,
  });

  for (const [key, value] of Object.entries(result.headers || {})) res.setHeader(key, value);
  res.status(result.statusCode).send(result.body);
};
