# Edge TTS Subtitles - Cloudflare Worker

A high-performance Cloudflare Worker that provides free, high-quality Text-to-Speech (TTS) audio with synchronized subtitle metadata using Microsoft Edge's online TTS service.

## Features

- 🎤 **OpenAI-Compatible Endpoint** - Drop-in replacement for OpenAI's TTS API
- 📝 **Subtitle Generation** - Automatic word-level timing for SRT and VTT formats
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
  -d '{"input": "Hello, world!", "voice": "en-US-EmmaMultilingualNeural"}' \
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
    "subtitle_format": "vtt"
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

See [API_USAGE.md](./API_USAGE.md) for detailed documentation and examples.


## Get started

1. Sign up for [Cloudflare Workers](https://workers.dev). The free tier is sufficient for most use cases.
2. Clone this project and install dependencies with `npm install`
3. Run `wrangler login` to login to your Cloudflare account in wrangler
4. Run `wrangler deploy` to publish the API to Cloudflare Workers

## Development

1. Run `wrangler dev` to start a local instance of the API.
2. Test the endpoints using curl or your favorite HTTP client.
3. Changes made in the `src/` folder will automatically trigger the server to reload.

## Technical Details

- **Runtime**: Cloudflare Workers (V8 isolates)
- **TTS Engine**: `edge-tts-universal` package (isomorphic build)
- **Audio Format**: MP3 (24kHz, 48kbps, mono)
- **Subtitle Formats**: SRT (SubRip) and VTT (WebVTT)

## License

This project is open source and available under the MIT License.
