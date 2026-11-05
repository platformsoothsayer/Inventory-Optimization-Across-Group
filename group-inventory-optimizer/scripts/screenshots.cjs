/* Capture slide screenshots from the production build (out/) at 1600x900 in presentation mode.
   Usage: npm run build && npm run screenshots */
/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..", "out");
const OUT = path.join(__dirname, "..", "screenshots");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".txt": "text/plain" };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split("?")[0]);
      let file = path.join(ROOT, url);
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (!fs.existsSync(file)) {
        res.writeHead(404);
        return res.end("not found");
      }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, () => resolve(server));
  });
}

const SHOTS = [
  { name: "panorama.png", path: "/", extra: "" },
  { name: "unidad-detalle.png", path: "/unidades/", extra: "&story=1" },
  { name: "plan-traspasos.png", path: "/plan/", extra: "" },
  { name: "como-funciona.png", path: "/como-funciona/", extra: "" },
];

(async () => {
  if (!fs.existsSync(ROOT)) throw new Error("Run npm run build first (out/ missing)");
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch();
  const errors = [];
  for (const lang of ["es", "en"]) {
    fs.mkdirSync(path.join(OUT, lang), { recursive: true });
    for (const s of SHOTS) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
      page.on("pageerror", (e) => errors.push(`${lang}${s.path}: ${e}`));
      page.on("console", (m) => m.type() === "error" && errors.push(`${lang}${s.path}: ${m.text().slice(0, 200)}`));
      await page.goto(`http://localhost:${port}${s.path}?lang=${lang}&present=1${s.extra}`, { waitUntil: "networkidle" });
      await page.waitForSelector("footer");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800);
      const file = path.join(OUT, lang, s.name);
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1600, height: 900 } });
      console.log("saved", path.relative(path.join(__dirname, ".."), file));
      await page.close();
    }
  }
  await browser.close();
  server.close();
  if (errors.length) {
    console.log("Browser errors:\n" + errors.join("\n"));
    process.exit(1);
  }
})();
