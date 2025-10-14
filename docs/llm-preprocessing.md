# LLM Preprocessing (client-side)

Two toggleable preprocessing modes are available on the demo UI for client-side processing:

1. `optimize_for_tts` — cleans and optimizes input text for TTS (expand abbreviations, normalize symbols, flatten lists)
2. `add_ssml_markup` — generate SSML markup (breaks, emphasis, say-as, prosody) to improve naturalness

Requirements:

- An OpenAI-compatible endpoint (e.g. `https://api.openai.com/v1/chat/completions`)
- An API key

Security: The demo stores your API key and endpoint in LocalStorage only. **All LLM processing happens client-side in your browser.** The API key never leaves your browser and is never sent to the worker. The browser calls the LLM API directly, then sends the processed text or SSML to the TTS API.

Usage in the demo UI:

1. Enable "🤖 Enable LLM Preprocessing"
2. Enter your LLM endpoint URL and API key
3. Select preprocessing options:
   - ✅ Optimize text for TTS
   - ✅ Add SSML markup
4. Click "Generate Speech & Subtitles"

The client-side JavaScript will:

1. Call the LLM API to optimize the text (if enabled)
2. Call the LLM API to add SSML markup (if enabled)
3. Send the processed text/SSML to the TTS API using the `raw_ssml` parameter

This approach ensures maximum security and reduces worker execution time.
