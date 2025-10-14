# Implementation notes

Key files:

- `src/index.ts` — worker entry and route handling
- `src/demo.ts` — demo page HTML + client script with client-side LLM preprocessing
- `src/types.ts` — request interfaces
- `src/openapi.json.ts` — OpenAPI spec
- `src/swagger-ui.ts` — Swagger UI HTML

Prosody/SSML: the worker normalizes inputs for rate/pitch/volume and constructs SSML when requested. `raw_ssml` allows bypassing normalization.

LLM Preprocessing: The demo UI includes client-side LLM preprocessing functions that call OpenAI-compatible APIs directly from the browser. The processed text/SSML is then sent to the worker via the `raw_ssml` parameter. This ensures API keys never leave the browser.
