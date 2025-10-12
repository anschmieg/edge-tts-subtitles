# TTS API Endpoints

This Cloudflare Worker provides two API endpoints for Text-to-Speech (TTS) using Microsoft Edge's online TTS service via the `edge-tts-universal` package.

## Endpoints

### 1. `/v1/audio/speech` - OpenAI-Compatible Endpoint

Returns raw MP3 audio data.

**Method:** `POST`

**Request Body:**

```json
{
  "input": "Text to convert to speech",
  "voice": "en-US-EmmaMultilingualNeural"
}
```

You can also control prosody and provide raw SSML. Supported optional fields:

```json
{
  "rate": "1.0",        // e.g. '0.9', '1.2', 'slow', 'fast'
  "pitch": "+2st",      // e.g. '+2st', '-1st', 'low'
  "volume": "loud",     // e.g. 'x-soft', 'medium', 'loud'
  "raw_ssml": "<speak>...</speak>" // optional: raw SSML takes precedence
}
```

**LLM Preprocessing (Optional):**

You can optionally enable LLM preprocessing to optimize text for TTS or add SSML markup automatically:

```json
{
  "llm_api_key": "sk-...",              // API key for OpenAI-compatible endpoint
  "llm_endpoint": "https://api.openai.com/v1/chat/completions", // OpenAI-compatible endpoint
  "optimize_for_tts": true,              // Enable text optimization for TTS
  "add_ssml_markup": true                // Enable automatic SSML markup generation
}
```

When `optimize_for_tts` is enabled, the LLM will:
- Replace uncommon characters with spoken equivalents
- Simplify lists and bullet points to natural prose
- Expand abbreviations and acronyms
- Fix typos and formatting issues

When `add_ssml_markup` is enabled, the LLM will:
- Add break tags for natural pauses
- Add emphasis tags for important words
- Add prosody adjustments for specific phrases
- Add say-as tags for dates, times, and numbers

For a browsable API specification and interactive UI, open `/docs` on your worker (for local dev: `http://localhost:8787/docs`). The OpenAPI JSON is available at `/openapi.json`.

Normalization rules:

- `rate`: numeric values like `1.2` are converted to percent (`120%`). Keywords such as `slow`, `fast`, `x-slow` are passed through.
- `pitch`: numeric values like `2` are converted to semitones `+2st`. Accepts `+2st`, `-1st`, `low`, `high`.
- `volume`: accepts keywords (`x-soft`, `medium`, `loud`), decibels (`-6dB`) or percent values. Numeric 0-1 values convert to percent (`0.8` -> `80%`).

**Response:**

- **Content-Type:** `audio/mpeg`
- **Body:** Raw MP3 audio data

**Example using curl:**

```bash
curl -X POST https://your-worker.workers.dev/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello, world!", "voice": "en-US-EmmaMultilingualNeural"}' \
  --output output.mp3
```

### 2. `/v1/audio/speech_subtitles` - Custom Subtitles Endpoint

Returns JSON with base64-encoded audio and synchronized subtitles.

**Method:** `POST`

**Request Body:**

```json
{
  "input": "Text to convert to speech",
  "voice": "en-US-EmmaMultilingualNeural",
  "subtitle_format": "srt",  // optional: "srt" or "vtt", defaults to "srt"
  "rate": "1.0",
  "pitch": "+2st",
  "volume": "medium"
}
```

You can also use LLM preprocessing (see above) with this endpoint:

```json
{
  "input": "Text to convert to speech",
  "voice": "en-US-EmmaMultilingualNeural",
  "llm_api_key": "sk-...",
  "llm_endpoint": "https://api.openai.com/v1/chat/completions",
  "optimize_for_tts": true,
  "add_ssml_markup": true
}
```

**Response:**

- **Content-Type:** `application/json`
- **Body:**

```json
{
  "audio_content_base64": "base64-encoded MP3 audio data",
  "subtitle_format": "srt",
  "subtitle_content": "SRT or VTT formatted subtitle content"
}
```

**Example using curl:**

```bash
curl -X POST https://your-worker.workers.dev/v1/audio/speech_subtitles \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Hello, world! This is a test.",
    "voice": "en-US-EmmaMultilingualNeural",
    "subtitle_format": "vtt"
  }' | jq .
```

**Example Response:**

```json
{
  "audio_content_base64": "//uQxAAAAAAAAAAA...",
  "subtitle_format": "vtt",
  "subtitle_content": "WEBVTT\n\n00:00:00.000 --> 00:00:00.500\nHello,\n\n00:00:00.500 --> 00:00:01.000\nworld!\n..."
}
```

## Available Voices

Some common voices you can use:

### English (US)

- `en-US-EmmaMultilingualNeural` (Female)
- `en-US-AndrewMultilingualNeural` (Male)
- `en-US-AvaMultilingualNeural` (Female)
- `en-US-BrianMultilingualNeural` (Male)

### English (UK)

- `en-GB-SoniaNeural` (Female)
- `en-GB-RyanNeural` (Male)

### Other Languages

- `es-ES-ElviraNeural` (Spanish, Female)
- `fr-FR-DeniseNeural` (French, Female)
- `de-DE-KatjaNeural` (German, Female)
- `ja-JP-NanamiNeural` (Japanese, Female)
- `zh-CN-XiaoxiaoNeural` (Chinese, Female)

For a full list of available voices, refer to the [Microsoft Edge TTS voices documentation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts).

## CORS Support

Both endpoints support CORS with `Access-Control-Allow-Origin: *` headers, allowing cross-origin requests from any domain.

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `400` - Bad Request (missing required fields)
- `405` - Method Not Allowed (non-POST requests)
- `404` - Not Found (invalid endpoint)
- `500` - Internal Server Error

Error responses include a JSON body with error details:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

## Subtitle Formats

### SRT (SubRip)

```srt
1
00:00:00,000 --> 00:00:00,500
Hello,

2
00:00:00,500 --> 00:00:01,000
world!
```

### VTT (WebVTT)

```vtt
WEBVTT

00:00:00.000 --> 00:00:00.500
Hello,

00:00:00.500 --> 00:00:01.000
world!
```

## Notes

- The TTS service is provided by Microsoft Edge's online TTS service
- No API key is required
- Audio is returned in MP3 format at 24kHz bitrate
- Subtitles include word-level timing information for precise synchronization
