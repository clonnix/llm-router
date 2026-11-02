// Personal LLM router: one API key, many providers.
// Exposes an OpenAI-compatible API and forwards requests to CometAPI (GLM, DeepSeek and more).
// No dependencies: needs Node 20+ (built-in fetch).

import http from "node:http";
import crypto from "node:crypto";
import { Readable } from "node:stream";

// ---------- Config ----------

// Send model names exactly as the provider names them, e.g. "glm-5.3-flash".
// To force a specific provider, prefix it: "<provider>/<model id>".
const PROVIDERS = {
  // CometAPI (cometapi.com). Has GLM-5.3 Flash and DeepSeek V4.1 Flash.
  // This is the default: any model without a known prefix goes here unchanged, e.g. "glm-5.3-flash".
  cometapi: {
    url: "https://api.cometapi.com/v1/chat/completions",
    key: process.env.COMETAPI_API_KEY,
  },
  // Add more providers here later, e.g.:
  // deepseek: { url: "https://api.deepseek.com/chat/completions", key: process.env.DEEPSEEK_API_KEY },
};

// Shown by GET /v1/models so apps can list them. Check each provider's model list for exact IDs.
// Check CometAPI's model list for exact IDs.
const MODELS = [
  "glm-5.3-flash",
  "deepseek-v4.1-flash",
];

// Models whose prefix isn't one of the PROVIDERS above are sent here with their full name.
const DEFAULT_PROVIDER = "cometapi";

// Your own key(s). Comma-separated, so each device/site can get its own and you can revoke one.
const API_KEYS = (process.env.API_KEYS || "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

// Which websites may call this from a browser. "*" = any (your key still protects it).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map((o) => o.trim());

const PORT = process.env.PORT || 3000;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB, long roleplay contexts get big

// ---------- Helpers ----------

const sha = (s) => crypto.createHash("sha256").update(s).digest();

function isAuthorized(req) {
  const header = req.headers.authorization || "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!given || API_KEYS.length === 0) return false;
  // Constant-time compare so the key can't be guessed by timing
  return API_KEYS.some((k) => crypto.timingSafeEqual(sha(k), sha(given)));
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const error = (res, status, message) =>
  sendJson(res, status, { error: { message, type: "router_error" } });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("too_large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// ---------- Routes ----------

async function chatCompletions(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (e) {
    return error(res, e.message === "too_large" ? 413 : 400, "Invalid or too large JSON body");
  }

  const fullModel = String(body.model || "");
  if (!fullModel) return error(res, 400, "Missing model");
  const slash = fullModel.indexOf("/");
  let prefix = slash > 0 ? fullModel.slice(0, slash) : "";
  let upstreamModel = fullModel.slice(slash + 1);

  // No known provider prefix: send the full model name to the default provider.
  if (!PROVIDERS[prefix]) {
    prefix = DEFAULT_PROVIDER;
    upstreamModel = fullModel;
  }
  const provider = PROVIDERS[prefix];
  if (!provider.key) return error(res, 500, `No API key configured for "${prefix}"`);

  // Cancel the upstream request if the client disconnects (saves tokens)
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  let upstream;
  try {
    upstream = await fetch(provider.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
      body: JSON.stringify({ ...body, model: upstreamModel }),
      signal: abort.signal,
    });
  } catch (e) {
    if (abort.signal.aborted) return;
    return error(res, 502, `Could not reach ${prefix}: ${e.message}`);
  }

  // Pass status + body straight through (works for both streaming and normal responses)
  res.writeHead(upstream.status, {
    "Content-Type": upstream.headers.get("content-type") || "application/json",
    "Cache-Control": "no-cache",
  });
  if (!upstream.body) return res.end();
  Readable.fromWeb(upstream.body)
    .on("error", () => res.end())
    .pipe(res);
}

function listModels(res) {
  sendJson(res, 200, {
    object: "list",
    data: MODELS.map((id) => ({ id, object: "model", owned_by: id.split("/")[0] })),
  });
}

// ---------- Server ----------

const server = http.createServer(async (req, res) => {
  setCors(req, res);
  const path = (req.url || "").split("?")[0].replace(/\/+$/, "");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  if (path === "/health") return sendJson(res, 200, { ok: true });

  if (!isAuthorized(req)) return error(res, 401, "Invalid API key");

  if (req.method === "POST" && path === "/v1/chat/completions") return chatCompletions(req, res);
  if (req.method === "GET" && path === "/v1/models") return listModels(res);

  error(res, 404, "Not found");
});

server.listen(PORT, () => {
  console.log(`LLM router listening on port ${PORT}`);
  if (API_KEYS.length === 0) console.warn("WARNING: API_KEYS is empty, every request will be rejected.");
});
