// Builds the static site into dist/. No dependencies: run `node build.mjs`.
//
// Templates (src/pages/*.html, src/partials/*.html) understand:
//   {{> name}}                    include src/partials/name.html
//   {{path.to.value}}             value from src/site.json or the page meta, HTML-escaped
//   {{#if path}} … {{else}} … {{/if}}   (not nested)
// Each page starts with <!--meta {"title": "...", "description": "...", "nav": "home"} -->.

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const root = dirname(new URL(import.meta.url).pathname);
const src = join(root, "src");
const out = join(root, "dist");
const check = process.argv.includes("--check");

const site = JSON.parse(readFileSync(join(src, "site.json"), "utf8"));
// SITE_URL overrides the address for a preview build (for example GitHub Pages under /wow-city-live-page).
site.url = (process.env.SITE_URL || site.url).replace(/\/$/, "");
const basePath = new URL(`${site.url}/`).pathname;
const read = (path) => readFileSync(path, "utf8");
const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const lookup = (data, path) => path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), data);

function render(template, data, depth = 0) {
  if (depth > 10) throw new Error("Partials nest too deeply");
  let html = template.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => render(read(join(src, "partials", `${name}.html`)), data, depth + 1));
  html = html.replace(/\{\{#if\s+([\w.]+)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g, (_, path, yes, no = "") => (lookup(data, path) ? yes : no));
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path) => {
    const value = lookup(data, path);
    if (value === undefined) throw new Error(`Unknown template value ${match}`);
    return escape(value);
  });
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(src, "assets"), join(out, "assets"), { recursive: true });
cpSync(join(src, "static"), out, { recursive: true });

const hash = createHash("sha256");
for (const file of files(join(src, "assets"))) hash.update(readFileSync(file));
const assetVersion = hash.digest("hex").slice(0, 10);

const wa = site.contact.whatsapp.replace(/\D/g, "");
const derived = {
  year: new Date().getFullYear(),
  assetVersion,
  basePath,
  signupUrl: `${site.appUrl}/auth/seller-signup`,
  loginUrl: `${site.appUrl}/auth/login`,
  staffLoginUrl: `${site.appUrl}/auth/worker-login`,
  whatsappUrl: wa ? `https://wa.me/${wa}?text=${encodeURIComponent(site.contact.whatsappMessage)}` : "",
  phoneUrl: site.contact.phone ? `tel:${site.contact.phone.replace(/[^\d+]/g, "")}` : "",
  emailUrl: site.contact.email ? `mailto:${site.contact.email}` : ""
};

const pages = readdirSync(join(src, "pages")).filter((name) => name.endsWith(".html"));
const layout = read(join(src, "partials", "layout.html"));
const built = [];

for (const name of pages) {
  const raw = read(join(src, "pages", name));
  const metaMatch = raw.match(/^<!--meta\s+([\s\S]*?)-->\s*/);
  if (!metaMatch) throw new Error(`${name} is missing its <!--meta {...} --> header`);
  const page = { file: name, path: name === "index.html" ? "" : name, ...JSON.parse(metaMatch[1]) };
  const data = { site, page, ...derived };
  const content = render(raw.slice(metaMatch[0].length), data);
  let html = render(layout, { ...data, content: "@@CONTENT@@" }).replace("@@CONTENT@@", content);
  if (page.nav) html = html.replaceAll(`data-nav="${page.nav}"`, `data-nav="${page.nav}" aria-current="page"`);
  writeFileSync(join(out, name), html);
  built.push(page);
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(out, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${built
    .filter((page) => !page.noindex)
    .map((page) => `  <url><loc>${site.url}/${page.path}</loc><lastmod>${today}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`
);
writeFileSync(join(out, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);

// Every local link and asset must exist; no template syntax may leak into the output.
let problems = 0;
for (const page of built) {
  // <base> sets where relative links resolve from; it is not itself a link.
  const html = read(join(out, page.file)).replace(/<base [^>]*>/, "");
  if (/\{\{|\}\}/.test(html)) {
    console.error(`${page.file}: leftover template syntax`);
    problems++;
  }
  for (const [, ref] of html.matchAll(/(?:href|src)="([^"#?]+)[^"]*"/g)) {
    if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(ref)) continue;
    if (!existsSync(join(out, ref.replace(/^\//, "")))) {
      console.error(`${page.file}: broken link ${ref}`);
      problems++;
    }
  }
}

for (const key of ["phone", "whatsapp", "email"]) {
  if (!site.contact[key]) console.warn(`note: contact.${key} is empty in src/site.json, so it is hidden on the site`);
}
console.log(`Built ${built.length} pages into ${relative(process.cwd(), out) || "."} (assets v${assetVersion})`);
if (problems) {
  console.error(`${problems} problem(s) found`);
  process.exit(1);
}
if (check) console.log("Check passed: every local link resolves.");
