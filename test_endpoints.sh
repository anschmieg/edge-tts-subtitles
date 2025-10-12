#!/bin/bash

# Test script for TTS API endpoints
# Note: This requires the worker to be deployed and accessible

# Set your worker URL here
WORKER_URL="${WORKER_URL:-http://localhost:8787}"

echo "Testing TTS API endpoints at: $WORKER_URL"
echo ""

# Test 1: OpenAI-compatible endpoint
echo "=== Test 1: /v1/audio/speech (OpenAI-compatible) ==="
curl -X POST "$WORKER_URL/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Hello, this is a test of the text to speech API.",
    "voice": "en-US-EmmaMultilingualNeural"
  }' \
  --output /tmp/test_audio.mp3 \
  -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n"

if [ -f /tmp/test_audio.mp3 ]; then
  echo "✓ Audio file saved to /tmp/test_audio.mp3"
  echo "File size: $(stat -f%z /tmp/test_audio.mp3 2>/dev/null || stat -c%s /tmp/test_audio.mp3) bytes"
else
  echo "✗ Failed to save audio file"
fi

echo ""
echo "=== Test 2: /v1/audio/speech_subtitles (SRT format) ==="
curl -X POST "$WORKER_URL/v1/audio/speech_subtitles" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Hello, this is a test of the subtitle generation.",
    "voice": "en-US-EmmaMultilingualNeural",
    "subtitle_format": "srt"
  }' \
  -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
  | jq '{ subtitle_format, subtitle_preview: .subtitle_content[:200], audio_size: (.audio_content_base64 | length) }'

echo ""
echo "=== Test 3: /v1/audio/speech_subtitles (VTT format) ==="
curl -X POST "$WORKER_URL/v1/audio/speech_subtitles" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "This is a longer test with multiple words to generate better subtitles.",
    "voice": "en-GB-SoniaNeural",
    "subtitle_format": "vtt"
  }' \
  -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
  | jq '{ subtitle_format, subtitle_preview: .subtitle_content[:200], audio_size: (.audio_content_base64 | length) }'

echo ""
echo "=== Test 4: Error handling (missing fields) ==="
curl -X POST "$WORKER_URL/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Test"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "=== Test 5: CORS preflight ==="
curl -X OPTIONS "$WORKER_URL/v1/audio/speech" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v 2>&1 | grep -i "access-control"

echo ""
echo "All tests completed!"
