const WHOP_EVENTS_URL = "https://api.whop.com/api/v1/events";
const WHOP_API_VERSION = "2026-09-02-2";
const DEFAULT_ACCOUNT_ID = "biz_hAcPEVvW8oStv7";
const DEFAULT_EVENT_NAME = "complete_registration";

const ALLOWED_EVENTS = new Set([
  "lead",
  "submit_application",
  "contact",
  "complete_registration",
  "schedule",
  "view_content",
  "add_to_cart",
]);

exports.handler = async function handler(event) {
  if (!["GET", "POST"].includes(event.httpMethod)) {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  const params = parseIncomingParams(event);
  const secret = process.env.CLICKFLARE_POSTBACK_SECRET;

  if (!secret) {
    return json(500, { ok: false, error: "missing_clickflare_postback_secret" });
  }

  if (getParam(params, "secret", "postback_secret") !== secret && getHeader(event, "x-postback-secret") !== secret) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) {
    return json(500, { ok: false, error: "missing_whop_api_key" });
  }

  const accountId = process.env.WHOP_ACCOUNT_ID || DEFAULT_ACCOUNT_ID;
  const eventName = normalizeEventName(getParam(params, "event_name", "event") || DEFAULT_EVENT_NAME);
  const eventId = buildEventId(eventName, params);
  const payload = compact({
    account_id: accountId,
    event_name: eventName,
    action_source: "website",
    event_id: eventId,
    event_time: normalizeEventTime(getParam(params, "event_time", "timestamp", "created_at")),
    url: getParam(params, "url", "lpurl", "landing_page", "source_url"),
    referrer_url: getParam(params, "referrer_url", "referrer", "lp_ref"),
    value: parseNumber(getParam(params, "value", "payout", "revenue", "amount")),
    currency: normalizeCurrency(getParam(params, "currency")),
    context: compact({
      fbclid: getParam(params, "fbclid"),
      fbc: getParam(params, "fbc") || buildFbc(getParam(params, "fbclid")),
      fbp: getParam(params, "fbp"),
      gclid: getParam(params, "gclid"),
      gbraid: getParam(params, "gbraid"),
      wbraid: getParam(params, "wbraid"),
      ttclid: getParam(params, "ttclid"),
      ttp: getParam(params, "ttp"),
      msclkid: getParam(params, "msclkid"),
      ad_campaign_id: getParam(params, "ad_campaign_id", "campaign_id"),
      ad_set_id: getParam(params, "ad_set_id", "adset_id"),
      ad_id: getParam(params, "ad_id"),
      utm_source: getParam(params, "utm_source"),
      utm_medium: getParam(params, "utm_medium"),
      utm_campaign: getParam(params, "utm_campaign"),
      utm_content: getParam(params, "utm_content"),
      utm_term: getParam(params, "utm_term"),
      ip_address: getParam(params, "ip", "ip_address") || getHeader(event, "x-nf-client-connection-ip") || getHeader(event, "client-ip"),
      user_agent: getParam(params, "user_agent", "ua") || getHeader(event, "user-agent"),
      language: getParam(params, "language"),
      timezone: getParam(params, "timezone"),
      screen_resolution: getParam(params, "screen_resolution"),
    }),
    user: compact({
      anonymous_id: getParam(params, "anonymous_id", "anon_id"),
      external_id: getParam(params, "external_id", "cf_click_id", "click_id", "subid"),
      email: getParam(params, "email"),
      phone: getParam(params, "phone"),
      name: getParam(params, "name"),
      first_name: getParam(params, "first_name"),
      last_name: getParam(params, "last_name"),
      country: getParam(params, "country"),
      state: getParam(params, "state"),
      city: getParam(params, "city"),
      postal_code: getParam(params, "postal_code", "zip"),
    }),
  });

  const response = await fetch(WHOP_EVENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Api-Version-Date": WHOP_API_VERSION,
      ...(eventId ? { "Idempotency-Key": eventId } : {}),
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let responseBody;
  try {
    responseBody = JSON.parse(responseText);
  } catch {
    responseBody = { raw: responseText.slice(0, 500) };
  }

  if (!response.ok) {
    return json(502, {
      ok: false,
      error: "whop_request_failed",
      status: response.status,
      whop: responseBody,
    });
  }

  return json(200, {
    ok: true,
    whop_event_id: responseBody.id,
    event_name: eventName,
    event_id: eventId || null,
  });
};

function parseIncomingParams(event) {
  const params = new URLSearchParams(event.rawQuery || "");

  if (event.body) {
    const body = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    const contentType = getHeader(event, "content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        const data = JSON.parse(body);
        for (const [key, value] of Object.entries(flatten(data))) {
          if (value != null && value !== "") params.set(key, String(value));
        }
      } catch {}
    } else {
      try {
        const formParams = new URLSearchParams(body);
        for (const [key, value] of formParams.entries()) {
          if (value != null && value !== "") params.set(key, value);
        }
      } catch {}
    }
  }

  return params;
}

function flatten(input, prefix = "", output = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return output;
  for (const [key, value] of Object.entries(input)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, nextKey, output);
    } else {
      output[nextKey] = value;
      output[key] = output[key] ?? value;
    }
  }
  return output;
}

function getParam(params, ...keys) {
  for (const key of keys) {
    const value = params.get(key);
    if (value != null && value !== "") return value;
  }
  return undefined;
}

function getHeader(event, name) {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(event.headers || {})) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

function normalizeEventName(value) {
  const eventName = String(value || DEFAULT_EVENT_NAME).trim().toLowerCase().replace(/-/g, "_");
  return ALLOWED_EVENTS.has(eventName) ? eventName : DEFAULT_EVENT_NAME;
}

function buildEventId(eventName, params) {
  const raw = getParam(params, "event_id", "txid", "transaction_id", "conversion_id", "cf_click_id", "click_id", "external_id");
  if (!raw) return undefined;
  return `cf_${eventName}_${raw}`.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 240);
}

function normalizeEventTime(value) {
  if (!value) return undefined;
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric > 1e12 ? numeric : numeric * 1000)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function parseNumber(value) {
  if (!value) return undefined;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : undefined;
}

function normalizeCurrency(value) {
  if (!value) return undefined;
  const currency = String(value).trim().toLowerCase();
  return /^[a-z_]{3,8}$/.test(currency) ? currency : undefined;
}

function buildFbc(fbclid) {
  if (!fbclid) return undefined;
  return `fb.1.${Date.now()}.${fbclid}`;
}

function compact(value) {
  if (Array.isArray(value)) return value.map(compact).filter(item => item != null);
  if (!value || typeof value !== "object") return value;

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    const next = compact(item);
    if (next == null || next === "" || (typeof next === "object" && !Array.isArray(next) && Object.keys(next).length === 0)) {
      continue;
    }
    output[key] = next;
  }
  return output;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}
