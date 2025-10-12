# Architecture

Short overview: Cloudflare Worker routes requests, uses `edge-tts-universal` to connect to Microsoft TTS and generate audio + word timing, and returns audio/subtitles. Optional LLM preprocessing is performed by calling an OpenAI-compatible endpoint provided by the client.
