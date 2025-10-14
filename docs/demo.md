# Demo

The demo UI is served from the worker root (`/`) and loads from `src/demo.ts`.

Features:

- Generate audio and subtitles
- Prosody controls: rate, pitch, volume
- Optional client-side LLM preprocessing (all processing happens in your browser; API keys never sent to worker)

LocalStorage keys used by the demo:

- `llm_api_key` - Your LLM API key (never sent to worker)
- `llm_endpoint` - OpenAI-compatible endpoint URL
- `enable_llm` - Whether LLM preprocessing is enabled
- `optimize_for_tts` - Whether to optimize text for TTS
- `add_ssml_markup` - Whether to add SSML markup

The LLM preprocessing runs entirely client-side for maximum security and privacy.
