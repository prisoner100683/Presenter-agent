"use strict";

const assert = require("node:assert/strict");

const { normalizeGeneratedProject, parseModelOutput, sanitizeText, stripCodeFences } = require("../../automation/server");

function runTest(name, fn) {
  try {
    fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

runTest("stripCodeFences removes surrounding json fences", () => {
  const input = '```json\n{"projectTitle":"Deck"}\n```';

  assert.equal(stripCodeFences(input), '{"projectTitle":"Deck"}');
});

runTest("parseModelOutput accepts fenced JSON payloads", () => {
  const input = '```json\n{"projectTitle":"Deck","files":{"index.html":"<main>ok</main>"}}\n```';
  const parsed = parseModelOutput(input);

  assert.equal(parsed.projectTitle, "Deck");
  assert.equal(parsed.files["index.html"], "<main>ok</main>");
});

runTest("parseModelOutput repairs raw newlines inside JSON string values", () => {
  const input = `{
    "projectTitle": "Deck",
    "files": {
      "index.html": "<!doctype html>
<html>
  <body>Hello</body>
</html>"
    }
  }`;

  const parsed = parseModelOutput(input);

  assert.match(parsed.files["index.html"], /<body>Hello<\/body>/);
  assert.match(parsed.files["index.html"], /<!doctype html>\n<html>/);
});

runTest("parseModelOutput still rejects structurally invalid JSON", () => {
  assert.throws(
    () => parseModelOutput('{"projectTitle":"Deck","files":{"index.html":"x"}'),
    /Model content was not valid JSON/
  );
});

runTest("normalizeGeneratedProject builds a shell site from structured slides", () => {
  const generated = normalizeGeneratedProject(
    {
      projectTitle: "Structured Deck",
      themeName: "Signal",
      summary: "Compact model output",
      slides: [
        {
          slideNumber: 1,
          title: "Intro",
          kicker: "Opening",
          body: ["Point A", "Point B"],
          note: "Short note",
          image: "assets/diagram.png"
        }
      ],
      files: {
        "src/styles/theme.css": ":root { --accent: #000; }",
        "src/styles/app.css": ".bad { color: red; }",
        "src/core/presentation.js": "console.log('bad');"
      }
    },
    {
      projectTitle: "Fallback Title",
      summary: "Fallback summary"
    },
    ["diagram.png"]
  );

  assert.ok(generated.files["index.html"]);
  assert.ok(generated.files["src/content/slides.js"]);
  assert.ok(generated.files["src/core/presentation.js"]);
  assert.ok(generated.files["src/styles/app.css"]);
  assert.match(generated.files["src/content/slides.js"], /window\.__PRESENTATION_DATA__/);
  assert.match(generated.files["src/content/slides.js"], /assets\/diagram\.png/);
  assert.match(generated.files["index.html"], /presentation-app/);
  assert.doesNotMatch(generated.files["src/styles/app.css"], /\.bad/);
  assert.doesNotMatch(generated.files["src/core/presentation.js"], /console\.log\('bad'\)/);
});

runTest("normalizeGeneratedProject keeps explicit index html untouched", () => {
  const generated = normalizeGeneratedProject(
    {
      projectTitle: "Full Deck",
      files: {
        "index.html": "<!doctype html><html><body>full</body></html>"
      }
    },
    {
      projectTitle: "Fallback Title",
      summary: "Fallback summary"
    },
    []
  );

  assert.equal(generated.files["index.html"], "<!doctype html><html><body>full</body></html>");
  assert.equal(generated.files["src/content/slides.js"], undefined);
});

runTest("sanitizeText repairs common mojibake artifacts", () => {
  assert.equal(sanitizeText("Hit in L2 鈥?data copied into L1"), "Hit in L2 -data copied into L1");
  assert.equal(sanitizeText("2 脳 8KB"), "2 x 8KB");
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
