# LLM Preprocessing (client-side)

Important: to avoid SSRF and proxy-abuse risks, all LLM preprocessing (text optimization and SSML generation) must be performed in the browser (client-side). The worker accepts only either plain `input` (optimized text) or `raw_ssml` (fully-formed SSML). Do not send your LLM API key or endpoint to the worker.
Available modes (performed by the client):

1. `optimize_for_tts` — clean and optimize input text for TTS (expand abbreviations, normalize symbols, flatten lists, add natural punctuation).
2. `add_ssml_markup` — generate high-quality SSML markup (breaks, emphasis, say-as, prosody) for improved naturalness.

Requirements

- An OpenAI-compatible endpoint (e.g. `https://api.openai.com/v1/chat/completions`) that allows browser CORS requests, or a client-side-accessible LLM endpoint.
- A user-supplied API key (stored in LocalStorage by the demo) — keep it client-side only.

Security note

- Do not forward `llm_api_key` or `llm_endpoint` to the worker. If the LLM endpoint does not accept browser requests due to CORS, use the dev-only mock mode during UI development or provide an admin-controlled proxy (NOT recommended for public deployments).

System prompts (optimized)

Use these refined system prompts from the client when calling the user's LLM. They are tuned for predictable outputs and include clear output constraints.

Optimize-for-TTS system prompt

```text
You are a text optimization assistant for Text-to-Speech (TTS). Convert the user input into a speech-friendly, natural-sounding form while preserving meaning and proper nouns.

Rules:
- Replace common symbols with spoken equivalents (e.g. '@' -> 'at', '&' -> 'and', '%' -> 'percent', '$' -> 'dollars').
- Expand common abbreviations (e.g. 'Dr.' -> 'Doctor', 'St.' -> 'Street').
- Convert lists and bullets into natural prose, adding commas or connectors as needed.
- Normalize phone numbers and dates to readable forms (e.g. '555-1234' -> '555 1234', '1/15/2024' -> 'January 15, 2024' if appropriate).
- Preserve meaning, proper nouns and brand names. Do not invent facts.
- Keep output concise and return ONLY the optimized text (no explanations or metadata).
```

Add-SSML-Markup system prompt

```text
You are an SSML author. Given plain text, add minimal, well-formed SSML to make speech sound natural. Output MUST start with <speak> and end with </speak> and contain only valid SSML tags.

Guidelines:
- Use <break time="...ms"/> or <break strength="..."/> for natural pauses (200ms for commas, 400ms for colons/semicolons, 500ms for sentences).
- Use <emphasis level="moderate|strong">...</emphasis> sparingly for important words.
- Use <say-as interpret-as="date|time|cardinal|ordinal|telephone|currency|characters"> for dates, times, numbers and acronyms where appropriate.
- Use <prosody rate="..." pitch="..." volume="..."> only where it improves clarity; avoid overuse.
- Self-close empty tags (e.g. <break time="300ms"/>). Ensure correct nesting.
- Return ONLY the SSML document (single string). No explanations, JSON or extra text.
```

Client integration example (browser)

This flow (client-side) produces either optimized text or SSML, then posts to the worker which performs TTS and subtitle generation.

```javascript
// call LLM (OpenAI-compatible chat completions)
async function callLLM(llmEndpoint, llmApiKey, systemPrompt, userText, timeoutMs = 15000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(llmEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        temperature: 0.2,
      }),
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`LLM call failed: ${res.status}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } finally { clearTimeout(t); }
}

// basic SSML validation
function validateSSML(ssml) {
  if (typeof ssml !== 'string') return false;
  if (!ssml.startsWith('<speak>') || !ssml.endsWith('</speak>')) return false;
  const selfClosing = (ssml.match(/<[a-zA-Z]+[^>]*\/\>/g) || []).length;
  const opens = (ssml.match(/<([a-zA-Z]+)(\s|>)/g) || []).length - selfClosing;
  const closes = (ssml.match(/<\/([a-zA-Z]+)>/g) || []).length;
  return opens === closes;
}

// after obtaining optimizedText or ssmlText, call the worker
async function postToWorker({ voice, subtitle_format, optimizedText, ssmlText }) {
  const body = ssmlText ? { raw_ssml: ssmlText, voice, subtitle_format } : { input: optimizedText, voice, subtitle_format };
  const r = await fetch('/v1/audio/speech_subtitles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Worker TTS failed');
  return r.json();
}
```

Notes and fallbacks

- Browser CORS: the LLM endpoint must allow browser requests. If it does not, use the demo's mock LLM mode for UI testing or provide a private admin proxy.
- Validate the LLM output client-side for quick feedback and server-side re-validation of `raw_ssml` before TTS as defense-in-depth.
- Store keys in LocalStorage only when the user explicitly supplies them; instruct users not to paste secrets into public demos.

```text
# LLM Preprocessing (optional)

Two toggleable preprocessing modes are available on the demo and via API parameters:

1. `optimize_for_tts` — cleans and optimizes input text for TTS (expand abbreviations, normalize symbols, flatten lists)
2. `add_ssml_markup` — generate SSML markup (breaks, emphasis, say-as, prosody) to improve naturalness

Requirements:

- An OpenAI-compatible endpoint (e.g. `https://api.openai.com/v1/chat/completions`)
- An API key

Security: The demo stores your API key and endpoint in LocalStorage only. The worker accepts those values from the client for the duration of the request only — they are not persisted server-side.

Usage example (JSON fields):

```json
{
  "input": "Text to convert",
  "voice": "en-US-EmmaMultilingualNeural",
  "optimize_for_tts": true,
  "add_ssml_markup": true,
  "llm_api_key": "sk-...",
  "llm_endpoint": "https://api.openai.com/v1/chat/completions"
}
```

System prompt and validation: the worker submits a well-crafted system prompt to the LLM and validates the LLM output to ensure it is valid SSML (has `<speak>` wrapper, no unclosed tags, uses self-closing `<break/>` syntax). If validation fails the worker returns an error and falls back to the raw input.
