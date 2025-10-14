# Edge TTS Subtitles - Cloudflare Worker

A high-performance Cloudflare Worker that provides free, high-quality Text-to-Speech (TTS) audio with synchronized subtitle metadata using Microsoft Edge's online TTS service.

## Features

- 🎤 **OpenAI-Compatible Endpoint** - Drop-in replacement for OpenAI's TTS API
- 📝 **Subtitle Generation** - Automatic word-level timing for SRT and VTT formats
- **Prosody Controls** - You can optionally set `rate`, `pitch`, and `volume` or provide raw SSML via `raw_ssml`
- 🤖 **Client-Side LLM Preprocessing** - Optional text optimization and SSML markup generation in the demo UI (your API key stays in your browser)
- 🌍 **Multiple Languages** - Support for 100+ voices in various languages
- ⚡ **Serverless** - Runs on Cloudflare's global edge network
- 🆓 **Free** - No API key required, leverages Microsoft Edge TTS
- 🔒 **CORS Enabled** - Works from any web application

## API Endpoints

### 1. `/v1/audio/speech` - OpenAI-Compatible

Returns raw MP3 audio data.

```bash
curl -X POST https://your-worker.workers.dev/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello, world!", "voice": "en-US-EmmaMultilingualNeural", "rate": "1.0", "pitch": "+2st"}' \
  --output output.mp3
```

### 2. `/v1/audio/speech_subtitles` - With Subtitles

Returns JSON with base64-encoded audio and synchronized subtitles.

```bash
curl -X POST https://your-worker.workers.dev/v1/audio/speech_subtitles \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Hello, world!",
    "voice": "en-US-EmmaMultilingualNeural",
    "subtitle_format": "vtt",
    "rate": "1.0",
    "pitch": "+2st",
    "volume": "loud"
  }'
```

**Response:**

```json
{
  "audio_content_base64": "base64-encoded MP3 data",
  "subtitle_format": "vtt",
  "subtitle_content": "WEBVTT subtitle content"
}
```

See the `docs/` folder for focused documentation. Start at `docs/index.md`.

Interactive API docs (Swagger UI) are available at `/docs` when the worker is running. The OpenAPI spec is available at `/openapi.json`.

## Web UI

A production-quality, static-hostable single-page web application is available in the `ui/` directory. The UI provides:

- 🎨 Beautiful, responsive design (React + Tailwind CSS)
- 🎤 Voice selection with demo playback
- 🎛️ Prosody controls (rate, pitch, volume)
- 🤖 Optional client-side LLM preprocessing
- 📝 Subtitle viewer with active cue highlighting
- 💾 Download options (MP3, SRT/VTT, ZIP)
- 🧪 Mock mode for offline testing

### Quick Start (UI)

```bash
cd ui
npm install
npm run dev
```

Then open <http://localhost:5173> in your browser.

For detailed UI documentation, see [`ui/README.md`](ui/README.md).

### Deploy UI

Build for production:

```bash
cd ui
npm run build
```

Deploy the `ui/dist/` folder to any static hosting service (Cloudflare Pages, Netlify, Vercel, etc.).

## Get started

1. Sign up for [Cloudflare Workers](https://workers.dev). The free tier is sufficient for most use cases.
2. Clone this project and install dependencies with `npm install`
3. Run `wrangler login` to login to your Cloudflare account in wrangler
4. Run `wrangler deploy` to publish the API to Cloudflare Workers

## Development

### Worker Development

1. Run `wrangler dev` to start a local instance of the API.
2. Test the endpoints using curl or your favorite HTTP client.
3. Changes made in the `src/` folder will automatically trigger the server to reload.

The demo UI is served from the worker root (GET `/`) and the single source-of-truth page lives in `src/demo.ts`.

### UI Development

1. Start the worker: `wrangler dev` (in the root directory)
2. In a separate terminal, start the UI: `cd ui && npm run dev`
3. Open <http://localhost:5173> in your browser
4. The UI will connect to the worker at <http://localhost:8787>

Enable "Mock mode" in the UI to test without the worker.

## Technical Details

- **Runtime**: Cloudflare Workers (V8 isolates)
- **TTS Engine**: `edge-tts-universal` package (isomorphic build)
- **Audio Format**: MP3 (24kHz, 48kbps, mono)
- **Subtitle Formats**: SRT (SubRip) and VTT (WebVTT)

## License

This project is open source and available under the MIT License.
