#!/bin/bash

# Test script for LLM preprocessing endpoints
# This script demonstrates how to use the LLM preprocessing features

echo "Testing Edge TTS with LLM Preprocessing"
echo "========================================"
echo ""

# Note: Replace these with your actual values
API_KEY="your-openai-api-key"
LLM_ENDPOINT="https://api.openai.com/v1/chat/completions"
WORKER_URL="http://localhost:8787"

echo "1. Testing text optimization for TTS"
echo "------------------------------------"
curl -X POST "$WORKER_URL/v1/audio/speech_subtitles" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Hello! This is a test w/ some abbrev. & special chars #1",
    "voice": "en-US-EmmaMultilingualNeural",
    "llm_api_key": "'"$API_KEY"'",
    "llm_endpoint": "'"$LLM_ENDPOINT"'",
    "optimize_for_tts": true,
    "add_ssml_markup": false
  }' | jq '.subtitle_content' | head -20

echo ""
echo "2. Testing SSML markup generation"
echo "----------------------------------"
curl -X POST "$WORKER_URL/v1/audio/speech_subtitles" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Hello, world! This is very important. The meeting is on January 15th at 3pm.",
    "voice": "en-US-EmmaMultilingualNeural",
    "llm_api_key": "'"$API_KEY"'",
    "llm_endpoint": "'"$LLM_ENDPOINT"'",
    "optimize_for_tts": false,
    "add_ssml_markup": true
  }' | jq '.subtitle_content' | head -20

echo ""
echo "3. Testing both optimization and SSML markup"
echo "--------------------------------------------"
curl -X POST "$WORKER_URL/v1/audio/speech_subtitles" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "TODO: Call John @ 555-1234 re: Q1 results (ASAP!)",
    "voice": "en-US-EmmaMultilingualNeural",
    "llm_api_key": "'"$API_KEY"'",
    "llm_endpoint": "'"$LLM_ENDPOINT"'",
    "optimize_for_tts": true,
    "add_ssml_markup": true
  }' | jq '.subtitle_content' | head -20

echo ""
echo "Done!"
