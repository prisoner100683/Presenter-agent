# Session Progress

Date: 2026-03-12

## Completed

- Added a local semi-automated GUI entrypoint.
- Added Node-based local server and browser GUI:
  - `package.json`
  - `automation/server.js`
  - `automation/public/index.html`
  - `automation/public/styles.css`
  - `automation/public/app.js`
- Added local usage documentation:
  - `AUTOMATION_GUIDE.md`
- Added local secret/state ignore rules:
  - `.gitignore`
- Implemented PPTX extraction via PowerShell and `.NET ZipFile`.
- Implemented profile storage for OpenAI-compatible APIs in:
  - `.local/automation/profiles.json`
- Implemented generation pipeline:
  - save source file
  - extract PPTX text/assets
  - call model API
  - write generated site to `output/archive/{project}/vN/site/`
  - write version note to `versions/{project}/vN/notes.md`
- Implemented fallback site generator when model output is unusable.
- Fixed one parser issue:
  - model JSON wrapped in markdown fences is now stripped before `JSON.parse`
- Added a dedicated model-output parser:
  - `parseModelOutput()`
  - repairs raw newline / tab / carriage-return characters inside JSON string values before retrying `JSON.parse`
- Added local parser regression tests:
  - `tests/automation/model-output.test.js`
- Added npm script:
  - `npm run automation:test`
- Restored a local DeepSeek profile in:
  - `.local/automation/profiles.json`
- Verified live model calls again and captured newer failure modes:
  - `v8`: model returned content that still could not be parsed as complete JSON
  - `v9`: DeepSeek rejected `max_tokens: 16000` and reported valid range `[1, 8192]`
  - `v10`: generation did not complete within a 5-minute end-to-end run and left only a partial output directory
- Refactored the model output contract to prefer:
  - structured `slides` data
  - local shared shell generation for `index.html`
  - local generated `src/content/slides.js`
  - compatibility with older full-HTML responses
- Verified end-to-end live success with the smaller contract:
  - `v11`: generation completed in `model` mode

## Verified

- `node --check automation/server.js` passes.
- `npm run automation:test` passes.
- Local HTTP server can start and listen successfully.
- End-to-end PPTX pipeline runs successfully against:
  - `docs/source/Caches updating and coherence.pptx`
- Live generation request reaches DeepSeek successfully with:
  - Base URL: `https://api.deepseek.com/v1`
  - Model: `deepseek-chat`
- Live generation now also completes successfully in model mode for:
  - `output/archive/caches-updating-and-coherence/v11/site/`

## Current State

- Source file used:
  - `docs/source/Caches updating and coherence.pptx`
- Generated versions created during this session:
  - `output/archive/caches-updating-and-coherence/v3/site/`
  - `output/archive/caches-updating-and-coherence/v4/site/`
  - `output/archive/caches-updating-and-coherence/v5/site/`
- Latest run:
  - `v5`

## Outstanding Problem

The model call is reachable with:
- Base URL: `https://api.deepseek.com/v1`
- Model: `deepseek-chat`

But generation still falls back because the returned payload is not accepted as final usable output yet.

Observed issues so far:

1. One earlier DeepSeek endpoint returned `429 Request Blocked`.
2. With `https://api.deepseek.com/v1`, the response is no longer blocked.
3. Even after stripping markdown code fences, the run still landed in fallback for `v5`.
4. The exact fallback reason for `v5` was identified:
   - model output looked like JSON but still failed parsing, consistent with malformed string content inside the JSON payload
5. Newer live verification showed the larger remaining issue was output size / completion reliability rather than only parser robustness:
   - `v8` content appears incomplete or truncated
   - `v9` confirmed DeepSeek `max_tokens` upper bound is `8192`
   - `v10` did not finish inside the current end-to-end timeout window
6. After switching to a smaller structured-output contract, `v11` succeeded in `model` mode.

## First Steps Next Session

1. Review the `v11` model-generated site in a browser and check content quality slide-by-slide.
2. Add explicit request timeout handling and better raw-response diagnostics for model calls.
3. Optionally sanitize or constrain model-generated notes content if it includes mojibake or overclaims.
4. If model output still contains bad HTML patterns:
   - sanitize external fonts/CDNs
   - sanitize invalid emoji favicon/content if needed
   - keep output within local static constraints

## Run Commands

Start GUI:

```bash
npm run automation:start
```

Quick syntax check:

```bash
node --check automation/server.js
```
