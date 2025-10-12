# Demo

The demo UI is served from the worker root (`/`) and loads from `src/demo.ts`.

Features:

- Generate audio and subtitles
- Prosody controls: rate, pitch, volume
- Optional LLM preprocessing (requires user-provided LLM endpoint and API key stored in LocalStorage)

LocalStorage keys used by the demo:

- `llm_api_key`
- `llm_endpoint`
