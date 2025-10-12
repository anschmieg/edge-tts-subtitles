# Implementation notes

Key files:

- `src/index.ts` — worker entry and route handling
- `src/demo.ts` — demo page HTML + client script
- `src/types.ts` — request interfaces
- `src/openapi.json.ts` — OpenAPI spec
- `src/swagger-ui.ts` — Swagger UI HTML

Prosody/SSML: the worker normalizes inputs for rate/pitch/volume and constructs SSML when requested. `raw_ssml` allows bypassing normalization.
