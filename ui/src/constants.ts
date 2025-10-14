// Worker base URL - can be configured via environment variable
export const WORKER_BASE_URL = import.meta.env.VITE_WORKER_BASE_URL || 'http://localhost:8787';

// Example voices with demo samples
export const EXAMPLE_VOICES = [
  {
    id: 'en-US-EmmaMultilingualNeural',
    name: 'Emma (US English)',
    language: 'en-US',
    demoText: 'Hello, I am Emma. I can speak in a natural and friendly voice.',
  },
  {
    id: 'en-US-AndrewMultilingualNeural',
    name: 'Andrew (US English)',
    language: 'en-US',
    demoText: 'Hello, I am Andrew. I can speak clearly and professionally.',
  },
  {
    id: 'en-GB-SoniaNeural',
    name: 'Sonia (British English)',
    language: 'en-GB',
    demoText: 'Hello, I am Sonia. I speak with a British accent.',
  },
  {
    id: 'es-ES-ElviraNeural',
    name: 'Elvira (Spanish)',
    language: 'es-ES',
    demoText: 'Hola, soy Elvira. Hablo español con claridad.',
  },
];

// LLM System Prompts (exact copy from requirements)

// Optimize-for-TTS system prompt
export const OPTIMIZE_FOR_TTS_PROMPT = `You are a text optimization assistant for Text-to-Speech (TTS). Convert the user input into a speech-friendly, natural-sounding form while preserving meaning and proper nouns.

Rules:
- Replace common symbols with spoken equivalents (e.g. '@' -> 'at', '&' -> 'and', '%' -> 'percent', '$' -> 'dollars').
- Expand common abbreviations (e.g. 'Dr.' -> 'Doctor', 'St.' -> 'Street').
- Convert lists and bullets into natural prose, adding commas or connectors as needed.
- Normalize phone numbers and dates to readable forms where appropriate.
- Preserve meaning and proper nouns. Do not invent facts.
Return ONLY the optimized text — no explanation or metadata.`;

// Add-SSML-Markup system prompt
export const ADD_SSML_MARKUP_PROMPT = `You are an SSML author. Given plain text, add minimal, well-formed SSML to make speech sound natural. Output MUST start with <speak> and end with </speak> and contain only valid SSML tags.

Guidelines:
- Use <break time="...ms"/> or <break strength="..."/> for natural pauses (200ms for commas, 400ms for semicolons, 500ms for sentences).
- Use <emphasis level="moderate|strong"> sparingly for important words.
- Use <say-as interpret-as="date|time|cardinal|ordinal|telephone|currency|characters"> for dates/times/numbers/acronyms.
- Self-close empty tags and ensure correct nesting.
Return ONLY the SSML document — no explanation or metadata.`;

// Mock payload for development without worker
// Using a short silent MP3 base64 (approximately 0.5 second)
// This is a valid, minimal MP3 file
export const MOCK_AUDIO_BASE64 = 
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u////////////////////////////////////////////////////////////////////wAAAABMYXZjNTguMTM0AAAAAAAAAAAAAAAAJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7UEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export const MOCK_SUBTITLE_CONTENT = `1
00:00:00,000 --> 00:00:01,000
This is a mock demo.

2
00:00:01,000 --> 00:00:02,000
You can test the UI offline.

3
00:00:02,000 --> 00:00:03,500
Enable mock mode in development.`;

export interface MockPayload {
  audio_content_base64: string;
  subtitle_format: 'srt' | 'vtt';
  subtitle_content: string;
}

export const MOCK_PAYLOAD: MockPayload = {
  audio_content_base64: MOCK_AUDIO_BASE64,
  subtitle_format: 'srt',
  subtitle_content: MOCK_SUBTITLE_CONTENT,
};

// Rate presets
export const RATE_PRESETS = [
  { label: 'Slow', value: '0.75' },
  { label: 'Normal', value: '1.0' },
  { label: 'Fast', value: '1.25' },
  { label: 'Very Fast', value: '1.5' },
];

// Pitch presets
export const PITCH_PRESETS = [
  { label: 'Low', value: '-2st' },
  { label: 'Normal', value: '0st' },
  { label: 'High', value: '+2st' },
];

// Volume presets
export const VOLUME_PRESETS = [
  { label: 'Soft', value: 'soft' },
  { label: 'Medium', value: 'medium' },
  { label: 'Loud', value: 'loud' },
];
