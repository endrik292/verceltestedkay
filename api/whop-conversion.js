// ClickFlare-Postback -> Whop Events API (server-side conversion)
// Vercel Serverless Function: https://appmethode.com/api/whop-conversion/
// (vercel.json hat trailingSlash: true -> URL immer MIT Schraegstrich am Ende aufrufen)
//
// Env (nur in Vercel eintragen, nie ins Repo):
//   WHOP_API_KEY                Account API Key mit Recht event:create
//   WHOP_ACCOUNT_ID             biz_WMqYtzdeJjRJJg
//   CLICKFLARE_POSTBACK_SECRET  langer Zufallswert, steht auch in der ClickFlare-Postback-URL
//
// Doku: https://docs.whop.com/developer/ads/events-api

const WHOP_EVENTS_URL = "https://api.whop.com/api/v1/events";
const WHOP_API_VERSION = "2026-11-17-3";
const DEFAULT_EVENT_NAME = "complete_registration";
const DEFAULT_LP_URL = "https://appmethode.com/playzone-tanken1-whop/";

const ALLOWED_EVENTS = new Set([
  "lead",
  "submit_application",
  "contact",
  "complete_registration",
  "schedule",
  "view_content",
  "add_to_cart",
  "initiate_checkout",
  "purchase",
]);

// Parameter, die Whop beim Klick auf eine Whop-Anzeige an die LP-URL haengt.
// Daraus loest Whop Kampagne, Ad-Gruppe und Ad auf.
const WHOP_URL_PARAMS = [
  "waid",
  "wasid",
  "wacid",
  "utm_meta_ad_id",
  "utm_meta_adset_id",
  "utm_meta_campaign_id",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_placement",
  "utm_content",
  "utm_adset",
  "fbclid",
];

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return send(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const params = collectParams(req);
  const secret = process.env.CLICKFLARE_POSTBACK_SECRET;
  const apiKey = process.env.WHOP_API_KEY;
  const accountId = process.env.WHOP_ACCOUNT_ID;

  if (!secret) return send(res, 500, { ok: false, error: "missing_clickflare_postback_secret" });

  const given = get(params, "secret", "postback_secret") || header(req, "x-postback-secret");
  if (!given || !safeEqual(given, secret)) {
    return send(res, 401, { ok: false, error: "unauthorized" });
  }

  if (!apiKey) return send(res, 500, { ok: false, error: "missing_whop_api_key" });
  if (!accountId) return send(res, 500, { ok: false, error: "missing_whop_account_id" });

  const eventName = normalizeEventName(get(params, "event_name", "event"));
  if (!eventName) {
    return send(res, 400, { ok: false, error: "invalid_event_name", allowed: [...ALLOWED_EVENTS] });
  }

  const value = parseNumber(get(params, "payout", "value", "revenue", "amount"));
  if (eventName === "purchase" && !(value > 0)) {
    return send(res, 400, { ok: false, error: "purchase_requires_value" });
  }

  const wuid = get(params, "wuid", "_wuid", "anonymous_id", "whop_visitor_id");
  const clickId = get(params, "cf_click_id", "click_id", "clickid", "external_id");
  const eventId = buildEventId(eventName, get(params, "event_id", "txid", "transaction_id", "conversion_id") || clickId);

  const payload = compact({
    account_id: accountId,
    event_name: eventName,
    action_source: "website",
    event_id: eventId,
    event_time: normalizeEventTime(get(params, "event_time", "conversion_time", "timestamp")),
    url: get(params, "url", "lp_url", "lpurl") || buildLandingUrl(params),
    value,
    currency: value != null ? normalizeCurrency(get(params, "currency")) || "usd" : undefined,
    user: {
      anonymous_id: wuid,
      external_id: clickId,
      email: get(params, "email"),
      phone: get(params, "phone"),
      country: get(params, "country"),
    },
    context: {
      ad_id: get(params, "utm_meta_ad_id", "ad_id"),
      ad_set_id: get(params, "utm_meta_adset_id", "adset_id", "ad_set_id"),
      ad_campaign_id: get(params, "utm_meta_campaign_id", "campaign_id", "ad_campaign_id"),
      fbclid: get(params, "fbclid"),
      utm_source: get(params, "utm_source"),
      utm_medium: get(params, "utm_medium"),
      utm_campaign: get(params, "utm_campaign"),
      utm_content: get(params, "utm_content"),
      // Nur Werte aus dem Postback. Die Request-Header gehoeren ClickFlares Server, nicht dem Besucher.
      ip_address: get(params, "ip", "ip_address"),
      user_agent: get(params, "ua", "user_agent"),
    },
  });

  let response;
  try {
    response = await fetch(WHOP_EVENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Api-Version-Date": WHOP_API_VERSION,
        ...(eventId ? { "Idempotency-Key": eventId } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return send(res, 502, { ok: false, error: "whop_unreachable" });
  }

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }

  if (!response.ok) {
    return send(res, 502, { ok: false, error: "whop_request_failed", status: response.status, whop: body });
  }

  return send(res, 200, {
    ok: true,
    whop_event_id: body.id || null,
    event_name: eventName,
    event_id: eventId || null,
    matched_visitor: Boolean(wuid),
  });
};

// ---------- Hilfsfunktionen ----------

function collectParams(req) {
  const params = new Map();
  const add = (obj) => {
    if (!obj || typeof obj !== "object") return;
    for (const [key, raw] of Object.entries(obj)) {
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (value == null || typeof value === "object") continue;
      const str = String(value).trim();
      // Leere Werte und nicht ersetzte ClickFlare-Tokens wie "{trackingField10}" ignorieren
      if (str === "" || /^\{[^}]*\}$/.test(str)) continue;
      params.set(key, str);
    }
  };
  add(req.query);
  if (typeof req.body === "string") {
    try {
      add(Object.fromEntries(new URLSearchParams(req.body)));
    } catch {}
  } else {
    add(req.body);
  }
  return params;
}

function get(params, ...keys) {
  for (const key of keys) {
    if (params.has(key)) return params.get(key);
  }
  return undefined;
}

function header(req, name) {
  const value = req.headers ? req.headers[name.toLowerCase()] : undefined;
  return Array.isArray(value) ? value[0] : value;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && require("crypto").timingSafeEqual(x, y);
}

function normalizeEventName(value) {
  if (!value) return DEFAULT_EVENT_NAME;
  const name = String(value).trim().toLowerCase().replace(/-/g, "_");
  return ALLOWED_EVENTS.has(name) ? name : undefined;
}

function buildEventId(eventName, raw) {
  if (!raw) return undefined;
  return `cf_${eventName}_${raw}`.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 240);
}

function buildLandingUrl(params) {
  const url = new URL(DEFAULT_LP_URL);
  for (const key of WHOP_URL_PARAMS) {
    const value = params.get(key);
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

function normalizeEventTime(value) {
  if (!value) return undefined;
  const numeric = Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric > 1e12 ? numeric : numeric * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function parseNumber(value) {
  if (value == null) return undefined;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : undefined;
}

function normalizeCurrency(value) {
  if (!value) return undefined;
  const currency = String(value).trim().toLowerCase();
  return /^[a-z]{3}$/.test(currency) ? currency : undefined;
}

function compact(value) {
  if (Array.isArray(value)) return value.map(compact).filter((item) => item != null);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    const next = compact(item);
    if (next == null || next === "") continue;
    if (typeof next === "object" && !Array.isArray(next) && Object.keys(next).length === 0) continue;
    output[key] = next;
  }
  return output;
}

function send(res, status, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(JSON.stringify(body));
}
