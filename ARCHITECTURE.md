# API Architecture

```
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
│  │  │  • Accepts: { input, voice }                         │  │  │
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

## Request Flow

### Endpoint 1: `/v1/audio/speech`
```
1. Client sends POST: { "input": "text", "voice": "voice-name" }
2. Worker validates request
3. Worker creates EdgeTTS instance
4. EdgeTTS connects to Microsoft via WebSocket
5. Microsoft generates audio + metadata
6. Worker receives audio chunks
7. Worker returns raw MP3 audio
```

### Endpoint 2: `/v1/audio/speech_subtitles`
```
1. Client sends POST: { "input": "text", "voice": "voice-name", "subtitle_format": "srt" }
2. Worker validates request
3. Worker creates EdgeTTS instance
4. EdgeTTS connects to Microsoft via WebSocket
5. Microsoft generates audio + word boundary metadata
6. Worker receives audio chunks and timing data
7. Worker converts audio to base64
8. Worker generates SRT/VTT subtitles from timing data
9. Worker returns JSON: { audio_content_base64, subtitle_format, subtitle_content }
```

## Data Flow

```
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
