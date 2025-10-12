# API reference

Endpoints:

- `POST /v1/audio/speech` — returns raw MP3 audio. Required: `input`, `voice`. Optional: `rate`, `pitch`, `volume`, `raw_ssml`.
- `POST /v1/audio/speech_subtitles` — returns JSON { audio_content_base64, subtitle_format, subtitle_content }. Required: `input`, `voice`. Optional prosody/LLM options.

Interactive docs are available at `/docs` (Swagger UI).
