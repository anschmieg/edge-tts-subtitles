# API Architecture

```diagram
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Application                          │
│                   (Browser, Node.js, Python, etc.)                  │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  │ HTTP POST
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Cloudflare Worker                             │
│                     (edge-tts-subtitles)                            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Router (switch)                          │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  /v1/audio/speech (OpenAI-compatible)                │  │  │
│  │  │  ─────────────────────────────────────               │  │  │
│  │  │  • Accepts: { input, voice, rate, pitch, volume }    │  │  │
│  │  │  • Returns: Raw MP3 audio                            │  │  │
│  │  │  • Content-Type: audio/mpeg                          │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  /v1/audio/speech_subtitles (Custom)                 │  │  │
│  │  │  ──────────────────────────────────                  │  │  │
│  │  │  • Accepts: { input, voice, subtitle_format }        │  │  │
│  │  │  • Returns: JSON with:                               │  │  │
│  │  │    - audio_content_base64                            │  │  │
│  │  │    - subtitle_format (srt/vtt)                       │  │  │
│  │  │    - subtitle_content                                │  │  │
│  │  │  • Content-Type: application/json                    │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              edge-tts-universal (Isomorphic)                │  │
│  │                                                             │  │
│  │  • EdgeTTS.synthesize()                                    │  │
│  │  • createSRT()                                             │  │
│  │  • createVTT()                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                │                                    │
└────────────────────────────────┼────────────────────────────────────┘
                                 │ WebSocket
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Microsoft Edge TTS Service                         │
│                 speech.platform.bing.com                            │
│                                                                     │
│  • Text-to-Speech synthesis                                        │
│  • Word-level timing metadata                                      │
│  • 100+ voices, multiple languages                                 │
│  • Free, no API key required                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Client-Side LLM Preprocessing (Demo UI Only)

The demo UI at `/` includes optional client-side LLM preprocessing:

```diagram
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Demo UI)                           │
│                                                                     │
│  User Input Text                                                    │
│       │                                                             │
│       ├─ (Optional) LLM Preprocessing ──────┐                       │
│       │                                     │                       │
│       │                              ┌──────▼──────┐                │
│       │                              │   LLM API   │                │
│       │                              │ (Client-    │                │
│       │                              │  side call) │                │
│       │                              └──────┬──────┘                │
│       │                                     │                       │
│       │  ┌──────────────────────────────────┘                       │
│       │  │                                                          │
│       ├──┴─ Optimized Text / SSML                                   │
│       │                                                             │
│       ▼                                                             │
│  POST /v1/audio/speech_subtitles                                    │
│  { input: text, voice: ..., raw_ssml: ... }                         │
│                                                                     │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
                    Cloudflare Worker
                    (TTS Generation Only)
```

**Benefits:**
- 🔒 API keys never leave the browser
- ⚡ Reduced worker execution time
- 💰 Lower worker costs
- 🛡️ Maximum security and privacy

## Request Flow

### Endpoint 1: `/v1/audio/speech`

1. Client sends POST: { "input": "text", "voice": "voice-name" }
2. Worker validates request
3. Worker creates EdgeTTS instance
4. EdgeTTS connects to Microsoft via WebSocket
5. Microsoft generates audio + metadata
6. Worker receives audio chunks
7. Worker returns raw MP3 audio

### Endpoint 2: `/v1/audio/speech_subtitles`

1. Client sends POST: { "input": "text", "voice": "voice-name", "subtitle_format": "srt" }
2. Worker validates request
3. Worker creates EdgeTTS instance
4. EdgeTTS connects to Microsoft via WebSocket
5. Microsoft generates audio + word boundary metadata
6. Worker receives audio chunks and timing data
7. Worker converts audio to base64
8. Worker generates SRT/VTT subtitles from timing data
9. Worker returns JSON: { audio_content_base64, subtitle_format, subtitle_content }

## Prosody & SSML

The worker supports optional prosody controls that let callers adjust speech rate, pitch, and volume. Supported request fields:

- `rate` — examples: `1.0`, `0.9`, `1.2`, `slow`, `fast`
- `pitch` — examples: `+2st`, `-1st`, `low`, `high`
- `volume` — examples: `x-soft`, `medium`, `loud`
- `raw_ssml` — when provided the worker will use this SSML string directly and skip prosody wrapping

When prosody fields are provided (and `raw_ssml` is not), the worker wraps the plain text into SSML using a `<prosody>` tag and passes that SSML to the TTS engine. `raw_ssml` takes precedence and is useful for advanced control.

## LLM Preprocessing (Client-Side Only)

The demo UI includes optional client-side LLM preprocessing. When enabled:

1. **Browser** calls LLM API to optimize text and/or generate SSML
2. **Browser** sends processed text/SSML to worker via `raw_ssml` parameter
3. **Worker** generates TTS audio (no LLM processing server-side)

This approach ensures API keys never leave the browser and reduces worker execution time.

## Demo UI

The demo UI is served from the worker root (GET `/`) and is stored as a single source-of-truth module at `src/demo.ts`. The demo uses same-origin calls (relative paths) so it automatically targets the worker that served the page.

## Data Flow

```diagram
Input Text
    │
    ▼
┌─────────────────┐
│   Validation    │
│ (input, voice)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  EdgeTTS Class  │
│  .synthesize()  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  Microsoft TTS WebSocket    │
│                             │
│  Sends: SSML + voice config │
│  Receives:                  │
│  • Audio chunks (binary)    │
│  • WordBoundary events      │
│    - text                   │
│    - offset                 │
│    - duration               │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│   Processing                │
│                             │
│ Audio: Blob → ArrayBuffer   │
│ Timing: WordBoundary[]      │
└────────┬────────────────────┘
         │
         ├─────────────────────┬──────────────────┐
         ▼                     ▼                  ▼
    ┌─────────┐          ┌─────────┐       ┌─────────┐
    │ Raw MP3 │          │ Base64  │       │   SRT   │
    │  Audio  │          │ Encoded │       │   VTT   │
    └─────────┘          └─────────┘       └─────────┘
         │                     │                  │
         ▼                     └────────┬─────────┘
    HTTP Response                      │
    (audio/mpeg)                       ▼
                                  JSON Response
                                  {
                                    audio_content_base64,
                                    subtitle_format,
                                    subtitle_content
                                  }
```

## Key Features

1. **CORS Enabled**: All endpoints support cross-origin requests
2. **Error Handling**: Comprehensive error responses with details
3. **Validation**: Request validation before processing
4. **Efficient**: Single TTS call per request
5. **Standards-Based**: Uses Web APIs (WebSocket, fetch, btoa)
6. **Serverless**: Runs on Cloudflare's global edge network
7. **Free**: No API key required, leverages Microsoft Edge TTS

## Performance

- **Latency**: ~1-3 seconds for typical requests
- **Bundle Size**: 29.12 KiB (8.21 KiB gzipped)
- **Audio Quality**: 24kHz, 48kbps MP3
- **Subtitle Precision**: Word-level timing (100ns resolution)
