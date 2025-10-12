# LLM Preprocessing (optional)

Two toggleable preprocessing modes are available on the demo and via API parameters:

1. `optimize_for_tts` — cleans and optimizes input text for TTS (expand abbreviations, normalize symbols, flatten lists)
2. `add_ssml_markup` — generate SSML markup (breaks, emphasis, say-as, prosody) to improve naturalness

Requirements:

- An OpenAI-compatible endpoint (e.g. `https://api.openai.com/v1/chat/completions`)
- An API key

Security: The demo stores your API key and endpoint in LocalStorage only. The worker accepts those values from the client for the duration of the request only — they are not persisted server-side.

Usage example (JSON fields):

```json
{
  "input": "Text to convert",
  "voice": "en-US-EmmaMultilingualNeural",
  "optimize_for_tts": true,
  "add_ssml_markup": true,
  "llm_api_key": "sk-...",
  "llm_endpoint": "https://api.openai.com/v1/chat/completions"
}
```

System prompt and validation: the worker submits a well-crafted system prompt to the LLM and validates the LLM output to ensure it is valid SSML (has `<speak>` wrapper, no unclosed tags, uses self-closing `<break/>` syntax). If validation fails the worker returns an error and falls back to the raw input.
