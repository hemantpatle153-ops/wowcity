// Serves dist/ on http://localhost:4173 for a local preview.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const dist = join(new URL(".", import.meta.url).pathname, "dist");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };
const port = Number(process.env.PORT ?? 4173);

createServer((request, response) => {
  let path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(dist, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  const found = existsSync(file);
  response.writeHead(found ? 200 : 404, { "content-type": types[extname(found ? file : ".html")] ?? "application/octet-stream" });
  response.end(readFileSync(found ? file : join(dist, "404.html")));
}).listen(port, () => console.log(`Preview: http://localhost:${port}`));
