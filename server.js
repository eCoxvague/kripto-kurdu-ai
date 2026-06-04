import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");

function loadDotEnv() {
  const envPath = join(__dirname, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const port = Number(process.env.PORT || 3000);
const agnesBaseUrl = "https://apihub.agnes-ai.com/v1";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function sendJson(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function getApiKey(req) {
  const headerKey = req.headers["x-agnes-api-key"];
  return (Array.isArray(headerKey) ? headerKey[0] : headerKey) || process.env.AGNES_API_KEY || "";
}

function extractRequestId(message = "") {
  const match = String(message).match(/request id:\s*([^)]+)/i);
  return match ? match[1].trim() : "";
}

function normalizeAgnesError(status, body) {
  const message = String(body?.message || body?.error || "");
  const code = String(body?.code || "");
  const type = String(body?.type || "");
  const isUpstreamFailure =
    code === "do_request_failed" ||
    /upstream error|do request failed/i.test(message);

  if (isUpstreamFailure) {
    return {
      status: status >= 400 && status < 600 ? status : 502,
      body: {
        error: "Agnes API isteği şu anda tamamlayamadı. Bu genelde sağlayıcı tarafında geçici yoğunluk veya bağlantı hatasıdır. Birkaç saniye sonra tekrar dene.",
        code: "agnes_upstream_failed",
        request_id: extractRequestId(message)
      }
    };
  }

  if (type === "AgnesAI_error" && status >= 400) {
    return {
      status,
      body: {
        error: message || "Agnes API isteği hata verdi.",
        code: code || "agnes_error",
        request_id: extractRequestId(message)
      }
    };
  }

  return null;
}

async function agnesRequest(req, path, options = {}) {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return {
      status: 400,
      body: { error: "API key bulunamadı. Üstteki API Ayarları bölümünden key gir veya .env içine AGNES_API_KEY ekle." }
    };
  }

  const headers = {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json"
  };

  let upstream;
  try {
    upstream = await fetch(`${agnesBaseUrl}${path}`, {
      method: options.method || "POST",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch {
    return {
      status: 502,
      body: {
        error: "Agnes API bağlantısı kurulamadı. İnternet bağlantısını ve Agnes servis durumunu kontrol edip tekrar dene.",
        code: "agnes_connection_failed"
      }
    };
  }

  const text = await upstream.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  const normalizedError = normalizeAgnesError(upstream.status, body);
  if (normalizedError) return normalizedError;

  return { status: upstream.status, body };
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/status") {
      return sendJson(res, 200, { hasServerKey: Boolean(process.env.AGNES_API_KEY) });
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      const body = await readJson(req);
      const result = await agnesRequest(req, "/chat/completions", { body });
      return sendJson(res, result.status, result.body);
    }

    if (req.method === "POST" && url.pathname === "/api/images") {
      const body = await readJson(req);
      const result = await agnesRequest(req, "/images/generations", { body });
      return sendJson(res, result.status, result.body);
    }

    if (req.method === "POST" && url.pathname === "/api/videos") {
      const body = await readJson(req);
      const result = await agnesRequest(req, "/videos", { body });
      return sendJson(res, result.status, result.body);
    }

    const videoMatch = url.pathname.match(/^\/api\/videos\/([^/]+)$/);
    if (req.method === "GET" && videoMatch) {
      const taskId = encodeURIComponent(videoMatch[1]);
      const result = await agnesRequest(req, `/videos/${taskId}`, { method: "GET" });
      return sendJson(res, result.status, result.body);
    }

    return sendJson(res, 404, { error: "API route not found." });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function serveStatic(res, pathname) {
  const safePath = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store, max-age=0",
      "pragma": "no-cache",
      "expires": "0"
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }

  await serveStatic(res, decodeURIComponent(url.pathname));
});

server.listen(port, () => {
  console.log(`Kripto Kurdu AI: http://localhost:${port}`);
});
