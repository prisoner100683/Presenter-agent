"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const http = require("http");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(__dirname, "public");
const LOCAL_DIR = path.join(ROOT, ".local", "automation");
const PROFILE_PATH = path.join(LOCAL_DIR, "profiles.json");
const DOCS_SOURCE_DIR = path.join(ROOT, "docs", "source");
const OUTPUT_ARCHIVE_DIR = path.join(ROOT, "output", "archive");
const PORT = Number(process.env.AWESOME_AUTOMATION_PORT || "3210");
const HOST = "127.0.0.1";

function ensureDirSync(target) {
  fs.mkdirSync(target, { recursive: true });
}

function ensureBaseLayout() {
  [
    LOCAL_DIR,
    DOCS_SOURCE_DIR,
    OUTPUT_ARCHIVE_DIR,
    path.join(ROOT, "docs", "outline"),
    path.join(ROOT, "docs", "decisions"),
    path.join(ROOT, "output", "preview"),
    path.join(ROOT, "output", "release"),
    path.join(ROOT, "versions")
  ].forEach(ensureDirSync);
}

function readJsonFile(filePath, fallbackValue) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return fallbackValue;
  }
}

async function writeJsonFile(filePath, value) {
  ensureDirSync(path.dirname(filePath));
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function sanitizeSlug(input) {
  const normalized = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `presentation-${Date.now()}`;
}

function slugFromFileName(fileName) {
  return sanitizeSlug(path.parse(fileName).name);
}

function listProfiles() {
  const payload = readJsonFile(PROFILE_PATH, { profiles: [] });
  return Array.isArray(payload.profiles) ? payload.profiles : [];
}

async function saveProfiles(profiles) {
  await writeJsonFile(PROFILE_PATH, { profiles });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, payload, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, { "Content-Type": contentType });
  response.end(payload);
}

function safeJoin(root, requestedPath) {
  const resolved = path.resolve(root, "." + requestedPath);
  if (!resolved.startsWith(root)) {
    throw new Error("Invalid path.");
  }
  return resolved;
}

async function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function decodeXmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, "\n");
}

function extractTagValues(xml, tagName) {
  const matches = [...xml.matchAll(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "g"))];
  return matches.map((match) => decodeXmlEntities(match[1])).filter(Boolean);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getNextVersion(projectDir) {
  if (!fs.existsSync(projectDir)) {
    return "v1";
  }

  const versions = fs
    .readdirSync(projectDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v\d+$/.test(entry.name))
    .map((entry) => Number(entry.name.slice(1)))
    .sort((left, right) => left - right);

  const next = versions.length ? versions[versions.length - 1] + 1 : 1;
  return `v${next}`;
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

function createChatCompletionsUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) {
    throw new Error("Base URL is required.");
  }
  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
}

function runPowerShellScript(command) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      { cwd: ROOT, maxBuffer: 1024 * 1024 * 20 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || stdout || error.message));
          return;
        }
        resolve({ stdout, stderr });
      }
    );
  });
}

async function expandPptxArchive(filePath, destinationDir) {
  const psFile = filePath.replace(/'/g, "''");
  const psDest = destinationDir.replace(/'/g, "''");
  await runPowerShellScript(
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
      `[System.IO.Compression.ZipFile]::ExtractToDirectory('${psFile}', '${psDest}');`
  );
}

async function extractPptxData(filePath, workingDir) {
  const extractRoot = path.join(workingDir, "pptx");
  ensureDirSync(extractRoot);
  await expandPptxArchive(filePath, extractRoot);

  const slidesDir = path.join(extractRoot, "ppt", "slides");
  const relsDir = path.join(slidesDir, "_rels");
  const mediaDir = path.join(extractRoot, "ppt", "media");
  const slideFiles = fs
    .readdirSync(slidesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^slide\d+\.xml$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => {
      const leftNum = Number(left.match(/\d+/)[0]);
      const rightNum = Number(right.match(/\d+/)[0]);
      return leftNum - rightNum;
    });

  const slides = [];
  const assets = [];

  slideFiles.forEach((fileName, index) => {
    const slideXml = fs.readFileSync(path.join(slidesDir, fileName), "utf8");
    const relPath = path.join(relsDir, `${fileName}.rels`);
    const textNodes = extractTagValues(slideXml, "a:t");
    const title = textNodes[0] || `Slide ${index + 1}`;
    const bullets = textNodes.slice(1);
    const images = [];

    if (fs.existsSync(relPath)) {
      const relXml = fs.readFileSync(relPath, "utf8");
      const relMatches = [
        ...relXml.matchAll(
          /Target="\.\.\/media\/([^"]+)"[^>]*Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/image"/g
        )
      ];

      relMatches.forEach((match) => {
        const mediaName = match[1];
        const sourcePath = path.join(mediaDir, mediaName);
        if (fs.existsSync(sourcePath)) {
          images.push(mediaName);
          if (!assets.find((asset) => asset.fileName === mediaName)) {
            assets.push({
              fileName: mediaName,
              sourcePath
            });
          }
        }
      });
    }

    slides.push({
      slideNumber: index + 1,
      title,
      text: textNodes.join("\n"),
      bullets,
      images
    });
  });

  return { slides, assets };
}

async function copyAssets(assetEntries, destinationDir) {
  ensureDirSync(destinationDir);
  const copied = [];
  for (const asset of assetEntries) {
    const targetPath = path.join(destinationDir, asset.fileName);
    await fsp.copyFile(asset.sourcePath, targetPath);
    copied.push(asset.fileName);
  }
  return copied;
}

async function callModel(profile, promptPayload) {
  const endpoint = createChatCompletionsUrl(profile.baseUrl);
  const requestBody = {
    model: profile.model,
    temperature: 0.6,
    max_tokens: 8192,
    messages: [
      {
        role: "system",
        content:
          "You are a senior frontend presentation generator. Return only valid JSON. Build a polished static presentation website from PPTX content. Do not wrap the response in markdown fences. Keep the JSON compact and avoid unnecessary whitespace outside file contents."
      },
      {
        role: "user",
        content: promptPayload
      }
    ]
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${profile.apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Model request failed (${response.status}): ${text}`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid model response: ${text}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Model response did not contain content.");
  }

  return parseModelOutput(content);
}

function stripCodeFences(value) {
  const trimmed = String(value || "").trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

function escapeRawControlCharactersInJsonStrings(value) {
  let result = "";
  let inString = false;
  let escaping = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaping) {
        result += char;
        escaping = false;
        continue;
      }

      if (char === "\\") {
        result += char;
        escaping = true;
        continue;
      }

      if (char === "\"") {
        result += char;
        inString = false;
        continue;
      }

      if (char === "\n") {
        result += "\\n";
        continue;
      }

      if (char === "\r") {
        result += "\\r";
        continue;
      }

      if (char === "\t") {
        result += "\\t";
        continue;
      }
    } else if (char === "\"") {
      inString = true;
    }

    result += char;
  }

  return result;
}

function parseModelOutput(content) {
  const normalized = stripCodeFences(content);

  try {
    return JSON.parse(normalized);
  } catch (initialError) {
    try {
      return JSON.parse(escapeRawControlCharactersInJsonStrings(normalized));
    } catch (repairError) {
      throw new Error(`Model content was not valid JSON: ${content}`);
    }
  }
}

function buildPrompt(input) {
  const slideSummary = input.slides.map((slide) => ({
    slideNumber: slide.slideNumber,
    title: slide.title,
    bullets: slide.bullets.slice(0, 8),
    images: slide.images.map((name) => `assets/${name}`)
  }));

  return JSON.stringify(
    {
      task: "Convert PPTX content into a static presentation website.",
      requirements: {
        outputFormat: {
          projectTitle: "string",
          themeName: "string",
          summary: "string",
          slides: [
            {
              slideNumber: "number",
              title: "string",
              kicker: "optional short string",
              body: ["array of concise bullet strings"],
              note: "optional paragraph string",
              image: "optional relative asset path like assets/example.png"
            }
          ],
          files: {
            "src/styles/theme.css": "CSS variable theme file",
            "src/styles/app.css": "main site styles for the shared local shell",
            "README.md": "how to open and present",
            "notes.md": "what was generated and key design decisions"
          }
        },
        designConstraints: [
          "Use a bold but professional aesthetic for a presentation website.",
          "No external dependencies or CDNs.",
          "Responsive design for desktop and mobile.",
          "Keyboard navigation with ArrowLeft ArrowRight Home End and F for fullscreen.",
          "Create visible progress and chapter navigation.",
          "Use image assets only if they exist and reference them as relative paths like assets/example.png.",
          "Respect reduced-motion preferences.",
          "Use semantic HTML and accessible controls.",
          "Prefer returning structured slide data plus CSS rather than a huge fully-rendered HTML deck.",
          "Do not use external dependencies or external font CDNs."
        ],
        contentGuidance: {
          scenario: input.scenario,
          audience: input.audience,
          stylePreference: input.style,
          stackPreference: input.stack
        },
        slideSummary
      },
      instruction:
        "Return only compact JSON. Prefer the smaller structured format: include a slides array and minimal files. Only return a full index.html if truly necessary. Keep file contents production-ready. Minimize whitespace outside file contents. If some slide text is sparse, infer structure but do not invent fake factual details."
    },
    null,
    2
  );
}

function getDefaultThemeCss() {
  return `:root {
  --bg: #f2eee7;
  --panel: rgba(255, 255, 255, 0.7);
  --panel-strong: rgba(255, 255, 255, 0.88);
  --ink: #132238;
  --muted: #516171;
  --line: rgba(19, 34, 56, 0.12);
  --accent: #db5c32;
  --accent-soft: #f2b07f;
  --shadow: 0 24px 80px rgba(19, 34, 56, 0.12);
  --radius: 24px;
}`;
}

function getDefaultAppCss() {
  return `* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body {
  font-family: "Segoe UI", "PingFang SC", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(219, 92, 50, 0.22), transparent 28%),
    linear-gradient(135deg, #e8e0d3 0%, #f7f3ec 56%, #efe6d8 100%);
  color: var(--ink);
}
button, input, select { font: inherit; }
.presentation-app { display: grid; grid-template-columns: 320px minmax(0, 1fr); min-height: 100vh; }
.rail {
  position: sticky; top: 0; display: flex; flex-direction: column; justify-content: space-between;
  gap: 24px; height: 100vh; padding: 32px 24px; background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(20px); border-right: 1px solid var(--line);
}
.eyebrow, .slide-kicker { margin: 0 0 12px; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); }
.rail h1, .slide-header h2 { margin: 0; font-family: Georgia, "Times New Roman", serif; line-height: 1; }
.rail h1 { font-size: clamp(2.2rem, 5vw, 3.6rem); }
.summary { color: var(--muted); font-size: 15px; line-height: 1.65; }
.slide-nav { display: grid; gap: 10px; }
.nav-item {
  width: 100%; min-height: 48px; padding: 12px 14px; border: 1px solid var(--line);
  border-radius: 16px; background: transparent; color: var(--ink); text-align: left;
  cursor: pointer; transition: background-color 180ms ease, transform 180ms ease, border-color 180ms ease;
}
.nav-item:hover, .nav-item:focus-visible, .nav-item.is-active {
  background: var(--panel-strong); border-color: rgba(219, 92, 50, 0.45); transform: translateX(4px); outline: none;
}
.rail-meta { display: flex; gap: 12px; flex-wrap: wrap; color: var(--muted); font-size: 12px; }
.deck { padding: 28px; }
.slide { display: none; min-height: calc(100vh - 56px); }
.slide.is-active { display: block; }
.slide-shell {
  display: grid; grid-template-rows: auto 1fr; gap: 28px; min-height: calc(100vh - 56px);
  padding: 40px; border: 1px solid var(--line); border-radius: 36px; background: var(--panel); box-shadow: var(--shadow);
}
.slide-header h2 { font-size: clamp(2rem, 5vw, 4rem); }
.slide-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 24px; align-items: start; }
.bullet-list { margin: 0; padding-left: 22px; display: grid; gap: 12px; font-size: clamp(1rem, 1.8vw, 1.25rem); line-height: 1.7; }
.slide-copy { max-width: 70ch; color: var(--muted); line-height: 1.75; font-size: 18px; }
.slide-visual { margin: 0; border-radius: 28px; overflow: hidden; border: 1px solid var(--line); background: rgba(255, 255, 255, 0.75); }
.slide-visual img { display: block; width: 100%; height: auto; }
.progress-shell { position: fixed; left: 320px; right: 0; bottom: 0; height: 6px; background: rgba(19, 34, 56, 0.08); }
.progress-bar { height: 100%; width: 0; background: linear-gradient(90deg, var(--accent), var(--accent-soft)); transition: width 220ms ease; }
@media (max-width: 980px) {
  .presentation-app { grid-template-columns: 1fr; }
  .rail { position: relative; height: auto; border-right: 0; border-bottom: 1px solid var(--line); }
  .deck { padding: 18px; }
  .slide-shell { min-height: auto; padding: 24px; }
  .slide-body { grid-template-columns: 1fr; }
  .progress-shell { left: 0; }
}
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}`;
}

function sanitizeSlideItems(items) {
  return Array.isArray(items)
    ? items
        .map((item) => sanitizeText(item))
        .filter(Boolean)
        .slice(0, 12)
    : [];
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/鈥\?/g, "-")
    .replace(/鉁\?/g, "OK")
    .replace(/脳/g, "x")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

function normalizeModelSlides(slides, copiedAssets) {
  if (!Array.isArray(slides) || !slides.length) {
    return [];
  }

  return slides.map((slide, index) => {
    const image = String(slide?.image || "").trim();
    const safeImage = image.startsWith("assets/") && copiedAssets.includes(path.basename(image)) ? image : "";
    return {
      slideNumber: Number(slide?.slideNumber) || index + 1,
      title: sanitizeText(slide?.title || `Slide ${index + 1}`) || `Slide ${index + 1}`,
      kicker: sanitizeText(slide?.kicker || `Slide ${index + 1}`),
      body: sanitizeSlideItems(slide?.body),
      note: sanitizeText(slide?.note),
      image: safeImage
    };
  });
}

function buildShellIndexHtml(projectTitle, summary) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(projectTitle)}</title>
    <link rel="stylesheet" href="./src/styles/theme.css">
    <link rel="stylesheet" href="./src/styles/app.css">
  </head>
  <body>
    <div class="presentation-app">
      <aside class="rail">
        <div>
          <p class="eyebrow">Auto Presenter</p>
          <h1>${escapeHtml(projectTitle)}</h1>
          <p class="summary">${escapeHtml(summary)}</p>
        </div>
        <nav class="slide-nav" id="slide-nav" aria-label="Slides"></nav>
        <div class="rail-meta">
          <span>Left / Right</span>
          <span>Home / End</span>
          <span>F = Fullscreen</span>
        </div>
      </aside>
      <main class="deck" aria-live="polite" id="deck"></main>
      <div class="progress-shell" aria-hidden="true">
        <div class="progress-bar" id="progress-bar"></div>
      </div>
    </div>
    <script src="./src/content/slides.js"></script>
    <script src="./src/core/presentation.js"></script>
  </body>
</html>`;
}

function buildShellPresentationScript() {
  return `"use strict";

(() => {
  const deck = document.getElementById("deck");
  const nav = document.getElementById("slide-nav");
  const progressBar = document.getElementById("progress-bar");
  const data = window.__PRESENTATION_DATA__ || { slides: [] };
  const slides = Array.isArray(data.slides) ? data.slides : [];
  let current = 0;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderShell() {
    if (!deck || !nav) return;

    deck.innerHTML = slides
      .map((slide, index) => {
        const bullets = Array.isArray(slide.body) && slide.body.length
          ? '<ul class="bullet-list">' + slide.body.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>'
          : '';
        const note = slide.note ? '<p class="slide-copy">' + escapeHtml(slide.note) + '</p>' : '';
        const image = slide.image ? '<figure class="slide-visual"><img src="' + encodeURI(slide.image) + '" alt="' + escapeHtml(slide.title) + ' image"></figure>' : '';

        return '<section class="slide' + (index === 0 ? ' is-active' : '') + '" data-slide-index="' + index + '">' +
          '<div class="slide-shell">' +
            '<header class="slide-header">' +
              '<span class="slide-kicker">' + escapeHtml(slide.kicker || ('Slide ' + (index + 1))) + '</span>' +
              '<h2>' + escapeHtml(slide.title) + '</h2>' +
            '</header>' +
            '<div class="slide-body">' +
              '<div class="slide-copy-wrap">' + bullets + note + '</div>' +
              image +
            '</div>' +
          '</div>' +
        '</section>';
      })
      .join('');

    nav.innerHTML = slides
      .map((slide, index) => '<button class="nav-item' + (index === 0 ? ' is-active' : '') + '" type="button" data-target-index="' + index + '">' + escapeHtml(slide.title) + '</button>')
      .join('');

    Array.from(nav.querySelectorAll(".nav-item")).forEach((item) => {
      item.addEventListener("click", () => render(Number(item.dataset.targetIndex || 0)));
    });
  }

  function render(index) {
    const slideNodes = Array.from(document.querySelectorAll(".slide"));
    const navItems = Array.from(document.querySelectorAll(".nav-item"));
    current = Math.max(0, Math.min(index, slideNodes.length - 1));

    slideNodes.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === current);
    });

    navItems.forEach((item, navIndex) => {
      item.classList.toggle("is-active", navIndex === current);
    });

    if (progressBar) {
      const progress = slideNodes.length > 1 ? ((current + 1) / slideNodes.length) * 100 : 100;
      progressBar.style.width = progress + "%";
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") render(current + 1);
    if (event.key === "ArrowLeft") render(current - 1);
    if (event.key === "Home") render(0);
    if (event.key === "End") render(slides.length - 1);
    if (event.key.toLowerCase() === "f") toggleFullscreen();
  });

  renderShell();
  render(0);
})();`;
}

function buildSlidesDataScript(slides) {
  return `window.__PRESENTATION_DATA__ = ${JSON.stringify({ slides }, null, 2)};\n`;
}

function normalizeGeneratedProject(generated, promptInput, copiedAssets) {
  const normalized = {
    projectTitle: sanitizeText(generated?.projectTitle || promptInput.projectTitle) || promptInput.projectTitle,
    themeName: sanitizeText(generated?.themeName || "Generated Deck") || "Generated Deck",
    summary: sanitizeText(generated?.summary || promptInput.summary) || promptInput.summary,
    files: { ...(generated?.files || {}) }
  };

  const modelSlides = normalizeModelSlides(generated?.slides, copiedAssets);
  if (modelSlides.length) {
    normalized.files["src/content/slides.js"] = buildSlidesDataScript(modelSlides);
    normalized.files["index.html"] = buildShellIndexHtml(normalized.projectTitle, normalized.summary);
    normalized.files["src/styles/theme.css"] = getDefaultThemeCss();
    normalized.files["src/styles/app.css"] = getDefaultAppCss();
    normalized.files["src/core/presentation.js"] = buildShellPresentationScript();
    normalized.files["README.md"] ||= `# ${normalized.projectTitle}

Open \`index.html\` directly in a browser, or serve this folder with any static file server for best results.

Keyboard shortcuts:
- Left / Right: previous or next slide
- Home / End: jump to first or last slide
- F: toggle fullscreen
`;
    normalized.files["notes.md"] ||= `# Generation Notes

- Generation mode: model
- Theme: ${normalized.themeName}
- Slides returned: ${modelSlides.length}
- Rendering: local shared shell with model-provided slide data
`;
  }

  return normalized;
}

function buildFallbackSite(input, copiedAssets) {
  const slideMarkup = input.slides
    .map((slide, index) => {
      const bullets = slide.bullets.length
        ? `<ul class="bullet-list">${slide.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        : `<p class="slide-copy">${escapeHtml(slide.text || "No extracted text was available for this slide.")}</p>`;

      const imageMarkup = slide.images
        .filter((name) => copiedAssets.includes(name))
        .slice(0, 1)
        .map(
          (name) =>
            `<figure class="slide-visual"><img src="assets/${encodeURIComponent(
              name
            )}" alt="${escapeHtml(slide.title)} image"></figure>`
        )
        .join("");

      return `
        <section class="slide${index === 0 ? " is-active" : ""}" id="slide-${slide.slideNumber}" data-slide-index="${index}">
          <div class="slide-shell">
            <header class="slide-header">
              <span class="slide-kicker">Slide ${slide.slideNumber}</span>
              <h2>${escapeHtml(slide.title)}</h2>
            </header>
            <div class="slide-body">
              <div class="slide-copy-wrap">
                ${bullets}
              </div>
              ${imageMarkup}
            </div>
          </div>
        </section>
      `;
    })
    .join("\n");

  const navMarkup = input.slides
    .map(
      (slide, index) =>
        `<button class="nav-item${index === 0 ? " is-active" : ""}" type="button" data-target-index="${index}">${escapeHtml(
          slide.title
        )}</button>`
    )
    .join("");

  return {
    projectTitle: input.projectTitle,
    themeName: "Signal Deck",
    summary: "Fallback site generated locally because the model response could not be parsed.",
    files: {
      "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(input.projectTitle)}</title>
    <link rel="stylesheet" href="./src/styles/theme.css">
    <link rel="stylesheet" href="./src/styles/app.css">
  </head>
  <body>
    <div class="presentation-app">
      <aside class="rail">
        <div>
          <p class="eyebrow">Auto Presenter</p>
          <h1>${escapeHtml(input.projectTitle)}</h1>
          <p class="summary">${escapeHtml(input.summary)}</p>
        </div>
        <nav class="slide-nav" aria-label="Slides">
          ${navMarkup}
        </nav>
        <div class="rail-meta">
          <span>Left / Right</span>
          <span>F = Fullscreen</span>
        </div>
      </aside>
      <main class="deck" aria-live="polite">
        ${slideMarkup}
      </main>
      <div class="progress-shell" aria-hidden="true">
        <div class="progress-bar" id="progress-bar"></div>
      </div>
    </div>
    <script src="./src/core/presentation.js"></script>
  </body>
</html>`,
      "src/styles/theme.css": getDefaultThemeCss(),
      "src/styles/app.css": getDefaultAppCss(),
      "src/core/presentation.js": `"use strict";

(() => {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const navItems = Array.from(document.querySelectorAll(".nav-item"));
  const progressBar = document.getElementById("progress-bar");
  let current = 0;

  function render(index) {
    current = Math.max(0, Math.min(index, slides.length - 1));
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === current);
    });
    navItems.forEach((item, navIndex) => {
      item.classList.toggle("is-active", navIndex === current);
    });
    const progress = slides.length > 1 ? ((current + 1) / slides.length) * 100 : 100;
    if (progressBar) {
      progressBar.style.width = progress + "%";
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") render(current + 1);
    if (event.key === "ArrowLeft") render(current - 1);
    if (event.key === "Home") render(0);
    if (event.key === "End") render(slides.length - 1);
    if (event.key.toLowerCase() === "f") toggleFullscreen();
  });

  navItems.forEach((item) => {
    item.addEventListener("click", () => render(Number(item.dataset.targetIndex || 0)));
  });

  render(0);
})();`,
      "README.md": `# ${input.projectTitle}

Open \`index.html\` directly in a browser, or serve this folder with any static file server for best results.

Keyboard shortcuts:
- Left / Right: previous or next slide
- Home / End: jump to first or last slide
- F: toggle fullscreen
`,
      "notes.md": `# Generation Notes

- Generation mode: local fallback
- Source file: ${input.sourceFileName}
- Extracted slides: ${input.slides.length}
- Copied assets: ${copiedAssets.length}
`
    }
  };
}

async function writeGeneratedFiles(siteRoot, generated) {
  const files = generated.files || {};
  const entries = Object.entries(files);
  if (!entries.length) {
    throw new Error("No files were returned by the model.");
  }

  for (const [relativePath, content] of entries) {
    const targetPath = path.join(siteRoot, relativePath);
    ensureDirSync(path.dirname(targetPath));
    await fsp.writeFile(targetPath, String(content), "utf8");
  }
}

async function runGeneration(input) {
  const projectSlug = sanitizeSlug(input.projectName || slugFromFileName(input.fileName));
  const projectArchiveDir = path.join(OUTPUT_ARCHIVE_DIR, projectSlug);
  const versionName = getNextVersion(projectArchiveDir);
  const versionRoot = path.join(projectArchiveDir, versionName);
  const siteRoot = path.join(versionRoot, "site");
  const siteAssetsDir = path.join(siteRoot, "assets");
  const sourceFileName = `${Date.now()}-${sanitizeSlug(path.parse(input.fileName).name)}${path.extname(input.fileName).toLowerCase()}`;
  const sourceFilePath = path.join(DOCS_SOURCE_DIR, sourceFileName);
  const workingDir = await fsp.mkdtemp(path.join(os.tmpdir(), "awesome-presenter-"));

  try {
    ensureDirSync(siteRoot);
    await fsp.writeFile(sourceFilePath, Buffer.from(input.fileDataBase64, "base64"));

    const extension = path.extname(input.fileName).toLowerCase();
    if (extension !== ".pptx") {
      throw new Error("This automation flow currently supports .pptx files only.");
    }

    const extracted = await extractPptxData(sourceFilePath, workingDir);
    const copiedAssets = await copyAssets(extracted.assets, siteAssetsDir);
    const promptInput = {
      projectTitle: path.parse(input.fileName).name,
      sourceFileName,
      scenario: input.scenario || "Presentation website",
      audience: input.audience || "General audience",
      style: input.style || "Professional editorial",
      stack: input.stack || "Vanilla HTML/CSS/JS",
      slides: extracted.slides,
      summary: `Generated from ${input.fileName}`
    };

    let generated;
    let generationMode = "model";

    try {
      generated = normalizeGeneratedProject(await callModel(input.profile, buildPrompt(promptInput)), promptInput, copiedAssets);
    } catch (error) {
      generationMode = "fallback";
      generated = buildFallbackSite(promptInput, copiedAssets);
      generated.files["notes.md"] += `\n- Fallback reason: ${error.message}\n`;
    }

    await writeGeneratedFiles(siteRoot, generated);

    const projectVersionDir = path.join(ROOT, "versions", projectSlug, versionName);
    ensureDirSync(projectVersionDir);
    await fsp.writeFile(
      path.join(projectVersionDir, "notes.md"),
      `# ${projectSlug} ${versionName}\n\n- Source: ${sourceFileName}\n- Mode: ${generationMode}\n`,
      "utf8"
    );

    const previewPath = `/generated/${encodeURIComponent(projectSlug)}/${encodeURIComponent(versionName)}/site/index.html`;
    return {
      projectSlug,
      versionName,
      generationMode,
      previewUrl: `http://${HOST}:${PORT}${previewPath}`,
      sitePath: path.join(siteRoot, "index.html"),
      copiedAssets: copiedAssets.length,
      slideCount: extracted.slides.length
    };
  } finally {
    await fsp.rm(workingDir, { recursive: true, force: true });
  }
}

function parseProfilePayload(body, existingProfile) {
  const nickname = String(body.nickname || "").trim();
  const baseUrl = normalizeBaseUrl(body.baseUrl);
  const model = String(body.model || "").trim();
  const apiKey = String(body.apiKey || "").trim() || existingProfile?.apiKey || "";

  if (!nickname || !baseUrl || !model || !apiKey) {
    throw new Error("Nickname, base URL, model, and API key are all required.");
  }

  return {
    id: body.id || crypto.randomUUID(),
    nickname,
    baseUrl,
    model,
    apiKey,
    updatedAt: new Date().toISOString()
  };
}

function maskProfile(profile) {
  return {
    id: profile.id,
    nickname: profile.nickname,
    baseUrl: profile.baseUrl,
    model: profile.model,
    apiKeyMasked:
      profile.apiKey.length <= 8
        ? "********"
        : `${profile.apiKey.slice(0, 4)}...${profile.apiKey.slice(-4)}`,
    updatedAt: profile.updatedAt
  };
}

function readGenerationMode(projectSlug, versionName) {
  const notesPath = path.join(ROOT, "versions", projectSlug, versionName, "notes.md");
  if (!fs.existsSync(notesPath)) {
    return "unknown";
  }
  const notes = fs.readFileSync(notesPath, "utf8");
  const match = notes.match(/- Mode:\s*([a-z0-9_-]+)/i);
  return match ? match[1] : "unknown";
}

function listGenerationHistory(limit = 12) {
  if (!fs.existsSync(OUTPUT_ARCHIVE_DIR)) {
    return [];
  }

  const entries = [];
  const projects = fs
    .readdirSync(OUTPUT_ARCHIVE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  projects.forEach((projectSlug) => {
    const projectDir = path.join(OUTPUT_ARCHIVE_DIR, projectSlug);
    const versions = fs
      .readdirSync(projectDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^v\d+$/.test(entry.name))
      .map((entry) => entry.name);

    versions.forEach((versionName) => {
      const indexPath = path.join(projectDir, versionName, "site", "index.html");
      if (!fs.existsSync(indexPath)) {
        return;
      }

      const stats = fs.statSync(indexPath);
      entries.push({
        projectSlug,
        versionName,
        generationMode: readGenerationMode(projectSlug, versionName),
        previewUrl: `http://${HOST}:${PORT}/generated/${encodeURIComponent(projectSlug)}/${encodeURIComponent(
          versionName
        )}/site/index.html`,
        sitePath: indexPath,
        updatedAt: stats.mtime.toISOString()
      });
    });
  });

  return entries
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, Math.max(1, Number(limit) || 12));
}

async function handleApiRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/history") {
    const limit = Number(url.searchParams.get("limit") || "12");
    sendJson(response, 200, { items: listGenerationHistory(limit) });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/profiles") {
    sendJson(response, 200, { profiles: listProfiles().map(maskProfile) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/profiles") {
    const body = JSON.parse((await readBody(request)).toString("utf8"));
    const profiles = listProfiles();
    const existingProfile = profiles.find((entry) => entry.id === body.id);
    const profile = parseProfilePayload(body, existingProfile);
    const nextProfiles = profiles.filter((entry) => entry.id !== profile.id);
    nextProfiles.push(profile);
    nextProfiles.sort((left, right) => left.nickname.localeCompare(right.nickname));
    await saveProfiles(nextProfiles);
    sendJson(response, 200, { profile: maskProfile(profile), profiles: nextProfiles.map(maskProfile) });
    return true;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/profiles/")) {
    const profileId = decodeURIComponent(url.pathname.split("/").pop());
    const nextProfiles = listProfiles().filter((entry) => entry.id !== profileId);
    await saveProfiles(nextProfiles);
    sendJson(response, 200, { profiles: nextProfiles.map(maskProfile) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/run") {
    const body = JSON.parse((await readBody(request)).toString("utf8"));
    const profiles = listProfiles();
    const profile = profiles.find((entry) => entry.id === body.profileId);
    if (!profile) {
      throw new Error("Selected model profile was not found.");
    }
    if (!body.fileName || !body.fileDataBase64) {
      throw new Error("A PPTX file is required.");
    }

    const result = await runGeneration({
      fileName: body.fileName,
      fileDataBase64: body.fileDataBase64,
      projectName: body.projectName,
      scenario: body.scenario,
      audience: body.audience,
      style: body.style,
      stack: body.stack,
      profile
    });

    sendJson(response, 200, { result });
    return true;
  }

  return false;
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let filePath;

  if (url.pathname === "/") {
    filePath = path.join(PUBLIC_DIR, "index.html");
  } else if (url.pathname.startsWith("/generated/")) {
    const relative = decodeURIComponent(url.pathname.replace("/generated", ""));
    filePath = safeJoin(OUTPUT_ARCHIVE_DIR, relative);
  } else {
    filePath = safeJoin(PUBLIC_DIR, decodeURIComponent(url.pathname));
  }

  try {
    const stat = await fsp.stat(filePath);
    const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const content = await fsp.readFile(finalPath);
    sendText(response, 200, content, getContentType(finalPath));
  } catch (error) {
    sendText(response, 404, "Not Found");
  }
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function openBrowser(url) {
  execFile("powershell", ["-NoProfile", "-Command", `Start-Process '${url.replace(/'/g, "''")}'`], () => {});
}

function createServer() {
  ensureBaseLayout();
  return http.createServer(async (request, response) => {
    try {
      const handled = await handleApiRequest(request, response);
      if (!handled) {
        await serveStatic(request, response);
      }
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
  });
}

function startServer() {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    const url = `http://${HOST}:${PORT}`;
    console.log(`Automation GUI ready at ${url}`);
    openBrowser(url);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  buildPrompt,
  buildFallbackSite,
  createServer,
  extractPptxData,
  getNextVersion,
  listGenerationHistory,
  maskProfile,
  normalizeBaseUrl,
  normalizeGeneratedProject,
  parseModelOutput,
  runGeneration,
  sanitizeText,
  sanitizeSlug,
  stripCodeFences,
  startServer
};
