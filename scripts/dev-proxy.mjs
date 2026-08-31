/**
 * Lokaler Reverse Proxy, der das Produktions-Layout aus
 * knowledge-base/platform/deployment.md nachbildet:
 *
 *   http://localhost:8080/        → 127.0.0.1:3002  (apps/site, Website)
 *   http://localhost:8080/admin/… → 127.0.0.1:3000  (apps/web, Backend)
 *   http://localhost:8080/api/…   → 127.0.0.1:3001  (apps/api, /api entfernt)
 *
 * Zweck: die Pfad-Aufteilung einmal wirklich durchlaufen lassen, statt sie
 * nur über drei getrennte Ports zu simulieren – inklusive der
 * X-Forwarded-*-Header, auf die die API sich verlässt (`trust proxy`).
 * Bewusst ohne Abhängigkeiten (nur node:http/node:net), damit dafür nichts
 * installiert werden muss. Kein TLS, keine Zugriffskontrolle: reines
 * Entwicklungswerkzeug, niemals produktiv einsetzen – dort machen das
 * nginx oder Caddy (Beispielkonfigurationen siehe Knowledge-Base).
 */
import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.DEV_PROXY_PORT ?? 8080);

/** Reihenfolge zählt: längster Pfad zuerst, "/" ist die Auffangregel –
 * genau wie die location-Blöcke in der nginx-Konfiguration. */
const ROUTES = [
  // `strip: true` entspricht dem abschließenden Slash in nginx'
  // `proxy_pass http://127.0.0.1:3001/;` – die API sieht /v1/… wie lokal.
  { prefix: "/api", port: 3001, strip: true, name: "api" },
  // Kein Strip: die Backend-App erwartet ihren basePath selbst.
  { prefix: "/admin", port: 3000, strip: false, name: "web" },
  { prefix: "/", port: 3002, strip: false, name: "site" },
];

function route(url) {
  for (const entry of ROUTES) {
    if (entry.prefix === "/") return entry;
    if (url === entry.prefix || url.startsWith(entry.prefix + "/")) {
      return entry;
    }
  }
  return ROUTES[ROUTES.length - 1];
}

function targetPath(url, entry) {
  if (!entry.strip) return url;
  const rest = url.slice(entry.prefix.length);
  return rest.startsWith("/") ? rest : "/" + rest;
}

function forwardedHeaders(req) {
  const existing = req.headers["x-forwarded-for"];
  const client = req.socket.remoteAddress ?? "";
  return {
    ...req.headers,
    "x-forwarded-for": existing ? `${existing}, ${client}` : client,
    "x-forwarded-proto": "http",
    "x-forwarded-host": req.headers.host ?? `localhost:${PORT}`,
    "x-real-ip": client,
  };
}

const server = http.createServer((req, res) => {
  const entry = route(req.url ?? "/");
  const proxied = http.request(
    {
      host: "127.0.0.1",
      port: entry.port,
      method: req.method,
      path: targetPath(req.url ?? "/", entry),
      headers: forwardedHeaders(req),
    },
    (upstream) => {
      res.writeHead(upstream.statusCode ?? 502, upstream.headers);
      upstream.pipe(res);
    },
  );
  proxied.on("error", (error) => {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(
      `Proxy: ${entry.name} auf Port ${entry.port} nicht erreichbar (${error.message}).\n` +
        `Läuft die App? pnpm dev startet alle drei.\n`,
    );
  });
  req.pipe(proxied);
});

// WebSockets: Next.js' Hot Reload im Dev-Modus läuft darüber; ohne diesen
// Zweig würde die Seite zwar laden, aber nicht mehr live aktualisieren.
server.on("upgrade", (req, socket, head) => {
  const entry = route(req.url ?? "/");
  const upstream = net.connect(entry.port, "127.0.0.1", () => {
    const headers = forwardedHeaders(req);
    const lines = [
      `${req.method} ${targetPath(req.url ?? "/", entry)} HTTP/1.1`,
      ...Object.entries(headers).map(([key, value]) => `${key}: ${value}`),
      "",
      "",
    ];
    upstream.write(lines.join("\r\n"));
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(PORT, () => {
  console.log(`Dev-Proxy läuft auf http://localhost:${PORT}`);
  for (const entry of ROUTES) {
    console.log(
      `  ${entry.prefix.padEnd(7)} → 127.0.0.1:${entry.port}` +
        (entry.strip ? "  (Präfix wird entfernt)" : ""),
    );
  }
});
