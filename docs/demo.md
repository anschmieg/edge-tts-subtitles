# Demo

The demo UI is served from the worker root (`/`) and loads from `src/demo.ts`.

Features:

- Generate audio and subtitles
- Prosody controls: rate, pitch, volume
- Client-side LLM preprocessing (optional) — the demo can call an OpenAI-compatible or custom LLM endpoint directly from the browser and then forward the processed text or SSML to the worker.

LocalStorage keys used by the demo (optional):

- `llm_api_key` (user-supplied, stored locally only)
- `llm_endpoint` (user-supplied LLM endpoint URL)

Mock mode for UI development:

- If the LLM endpoint does not allow browser CORS or you want fast UI testing, enable mock mode. The demo will call a local, dev-only mock LLM endpoint (if `ALLOW_DEV_MOCK=true` on the worker) that returns canned optimized text or SSML. This mock mode is for development only and must not be enabled in production.
