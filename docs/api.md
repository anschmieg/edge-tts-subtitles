# API reference

Endpoints:

## API Endpoints

- `GET /v1/voices` — returns JSON { voices: [...] } with list of all available voices including shortName, friendlyName, locale, language, gender, isMultilingual, displayName.
- `POST /v1/audio/speech` — returns raw MP3 audio. Required: `input`, `voice`. Optional: `rate`, `pitch`, `volume`, `raw_ssml`.
- `POST /v1/audio/speech_subtitles` — returns JSON { audio_content_base64, subtitle_format, subtitle_content }. Required: `input`, `voice`. Optional prosody/LLM options.

## Utility Endpoints

- `GET /__health` — health check endpoint for monitoring. Returns 204 No Content on success.
- `GET /__debug` — CORS debugging endpoint. Returns current CORS configuration and allowed origins.
- `GET /openapi.json` — returns the OpenAPI 3.0 specification in JSON format.
- `GET /docs` — interactive API documentation using Swagger UI.

Interactive docs are available at `/docs` (Swagger UI).
