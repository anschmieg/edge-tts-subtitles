# LLM Preprocessing Examples

This document provides examples of using the client-side LLM preprocessing features in the Edge TTS demo UI.

## Overview

The demo UI supports two optional LLM preprocessing modes that run **client-side in your browser**:

1. **Text Optimization for TTS** (`optimize_for_tts`): Cleans and optimizes input text for better TTS output
2. **SSML Markup Generation** (`add_ssml_markup`): Automatically adds SSML tags for natural pronunciation

Both features require an OpenAI-compatible LLM endpoint and API key. **All LLM processing happens in your browser** - your API key never leaves your browser and is never sent to the worker.

## Configuration

In the demo UI, you need to provide:

- **LLM Endpoint URL**: The OpenAI-compatible endpoint URL (e.g., `https://api.openai.com/v1/chat/completions`)
- **LLM API Key**: Your API key for the LLM service (stored in LocalStorage)

These settings are saved in your browser's LocalStorage for convenience.

## How It Works

When you enable LLM preprocessing in the demo:

1. **Client-side Processing**: Your browser calls the LLM API directly to process the text
2. **Text Optimization** (if enabled): The LLM optimizes the text for TTS
3. **SSML Generation** (if enabled): The LLM adds SSML markup for natural pronunciation
4. **TTS Generation**: The processed text/SSML is sent to the worker's TTS API using the `raw_ssml` parameter

This approach ensures:
- ✅ Your API key never leaves your browser
- ✅ The worker never handles your LLM credentials
- ✅ Reduced worker execution time
- ✅ Maximum security and privacy

## Using the Demo UI

1. Navigate to the demo at `/` (e.g., `http://localhost:8787/` or your deployed worker URL)
2. Check "🤖 Enable LLM Preprocessing"
3. Enter your LLM endpoint URL and API key
4. Select preprocessing options:
   - ✅ Optimize text for TTS
   - ✅ Add SSML markup
5. Enter your text and click "Generate Speech & Subtitles"

## Example 1: Text Optimization

**Input:** `"Hello! This is a test w/ some abbrev. & special chars #1"`

**After Optimization:** `"Hello! This is a test with some abbreviations and special characters number one"`

The optimization:
- Replaces `w/` with `with`
- Expands `abbrev.` to `abbreviations`
- Replaces `&` with `and`
- Replaces `#1` with `number one`

## Example 2: SSML Markup Generation

**Input:** `"Hello, world! This is very important. The meeting is on January 15th at 3pm."`

**After SSML Markup:**
```xml
<speak>
  Hello, world!<break time="500ms"/> 
  This is <emphasis level="strong">very important</emphasis>.<break time="500ms"/> 
  The meeting is on <say-as interpret-as="date" format="md">January 15th</say-as> 
  at <say-as interpret-as="time">3pm</say-as>.
</speak>
```

The SSML markup adds:
- Natural pauses after sentences
- Emphasis on "very important"
- Proper pronunciation of dates and times

## Example 3: Combined Processing

Use both optimization and SSML markup together for the best results.

**Input:** `"TODO: Call John @ 555-1234 re: Q1 results (ASAP!)"`

**Processing flow:**

1. First, text is optimized: `"To do: Call John at five five five one two three four regarding quarter one results as soon as possible"`
2. Then, SSML markup is added with appropriate emphasis and breaks

**Final SSML Output:**
```xml
<speak>
  To do: Call John at <say-as interpret-as="telephone">five five five one two three four</say-as>
  <break time="300ms"/>
  regarding quarter one results
  <break time="200ms"/>
  <emphasis level="strong">as soon as possible</emphasis>.
</speak>
```

## Alternative LLM Providers

The client-side implementation works with any OpenAI-compatible endpoint:

- **OpenAI**: `https://api.openai.com/v1/chat/completions`
- **Anthropic (via adapter)**: Use an OpenAI-compatible proxy
- **Local models (Ollama, LM Studio)**: `http://localhost:11434/v1/chat/completions`
- **Azure OpenAI**: `https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT/chat/completions?api-version=2024-02-15-preview`

## Best Practices

1. **Start with text optimization** if your input contains abbreviations or special characters
2. **Add SSML markup** for more natural-sounding speech with proper pauses and emphasis
3. **Use both together** for the best results on complex text
4. **Test with different voices** - SSML support may vary slightly between voices
5. **Keep your API key secure** - it's stored only in your browser's LocalStorage

## Troubleshooting

### Error: "LLM endpoint and API key are required"

Make sure you've entered both the endpoint URL and API key in the LLM settings section.

### Error: "LLM API request failed"

- Check that your API key is valid
- Verify the endpoint URL is correct
- Ensure you have sufficient credits/quota
- Check browser console for CORS errors (local LLM endpoints may need CORS configuration)

### Invalid SSML errors

If the LLM generates invalid SSML, the demo will show an error. Try:
- Simplifying your input text
- Using only text optimization without SSML markup
- Adjusting the LLM temperature (requires code modification)
