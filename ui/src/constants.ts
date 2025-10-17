// Worker endpoints: prefer a local Wrangler dev server when it's reachable.
const RAW_HOSTED_WORKER = (import.meta.env.VITE_WORKER_BASE_URL || 'http://edge-tts-subtitles.s-x.workers.dev').trim();
const PLACEHOLDER_HOST_FRAGMENT = 'your-worker.workers.dev';

const LOCAL_WRANGLER_URLS = ['http://127.0.0.1:8787', 'http://localhost:8787'];

let cachedWorkerBaseUrl: string | null = null;
let resolvingWorkerBaseUrl: Promise<string> | null = null;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function isLikelyLocal(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local')
  );
}

function normalizeWorkerBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Cannot normalize an empty worker URL.');
  }
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!isLikelyLocal(parsed.hostname) && parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    return stripTrailingSlash(parsed.toString());
  } catch {
    return stripTrailingSlash(`https://${trimmed}`);
  }
}

const HOSTED_WORKER_FALLBACK =
  RAW_HOSTED_WORKER && !RAW_HOSTED_WORKER.includes(PLACEHOLDER_HOST_FRAGMENT)
    ? normalizeWorkerBaseUrl(RAW_HOSTED_WORKER)
    : null;

// Probe a URL for basic network reachability. Uses a short timeout and
// performs a no-cors GET so the probe succeeds even if the target doesn't
// allow CORS. The probe only indicates network reachability (not 2xx/3xx).
async function isReachable(url: string, timeoutMs = 1500): Promise<boolean> {
  if (typeof fetch !== 'function' || typeof AbortController === 'undefined') {
    return false;
  }

  const controller = new AbortController();
  const signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // First try a dedicated health path if present for better determinism.
    // Fall back to origin root when health is not available.
    const healthProbe = stripTrailingSlash(url) + '/__health';
    try {
      await fetch(healthProbe, { method: 'GET', mode: 'no-cors', signal });
      return true;
    } catch {
      const probeUrl = stripTrailingSlash(url) + '/';
      await fetch(probeUrl, { method: 'GET', mode: 'no-cors', signal });
      return true;
    }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveWorkerBaseUrl(): Promise<string> {
  if (cachedWorkerBaseUrl) {
    return cachedWorkerBaseUrl;
  }

  if (!resolvingWorkerBaseUrl) {
    resolvingWorkerBaseUrl = (async () => {
      // Probe local Wrangler URLs only when running in a browser on a local
      // host. Previously the SSR branch caused probes during server-side
      // execution which is undesirable.
      const shouldProbeLocal = typeof window !== 'undefined' && isLikelyLocal(window.location.hostname);

      if (shouldProbeLocal) {
        for (const candidate of LOCAL_WRANGLER_URLS) {
          const normalizedCandidate = stripTrailingSlash(candidate);
          if (HOSTED_WORKER_FALLBACK && normalizedCandidate === HOSTED_WORKER_FALLBACK) {
            return normalizedCandidate;
          }
          const reachable = await isReachable(candidate);
          if (reachable) {
            return normalizedCandidate;
          }
        }
      }
      if (HOSTED_WORKER_FALLBACK) {
        return HOSTED_WORKER_FALLBACK;
      }

      if (typeof window !== 'undefined') {
        try {
          const currentOrigin = window.location.origin;
          const parsed = new URL(currentOrigin);
          if (!isLikelyLocal(parsed.hostname)) {
            return stripTrailingSlash(parsed.toString());
          }
        } catch {
          // ignore parsing issues
        }
      }

      throw new Error(
        'No worker endpoint configured. Start `wrangler dev` locally or set `VITE_WORKER_BASE_URL` to your deployed worker.'
      );
    })()
      .catch((error) => {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(String(error));
      })
      .then((url) => {
        cachedWorkerBaseUrl = url;
        return url;
      })
      .finally(() => {
        resolvingWorkerBaseUrl = null;
      });
  }

  return resolvingWorkerBaseUrl;
}

// Legacy export preserved for callers that only care about the hosted endpoint.
export const WORKER_BASE_URL = HOSTED_WORKER_FALLBACK ?? '';
export const LOCAL_WORKER_BASE_URLS = [...LOCAL_WRANGLER_URLS];

// Example voices with demo samples
/**
 * Lightweight voice descriptor used by the UI.
 */
export interface Voice {
  id: string;
  name: string;
  language?: string;
  demoText?: string;
}

export const EXAMPLE_VOICES: Voice[] = [
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

// Direct SSML generation prompt for fully-automatic pipelines. Use when no
// manual editing is desired: instruct the model to optimize text for speech
// and return valid SSML only. Keep temperature low and prefer short retries
// when validation fails.
export const DIRECT_SSML_PROMPT = `You are a strict SSML author and TTS optimizer. Given user text, produce a single, well-formed SSML document that speaks naturally.

Requirements:
- Output MUST be valid SSML and MUST start with <speak> and end with </speak>.
- Do not include any explanation, metadata, or surrounding markdown.
- Use minimal tags: <break/>, <emphasis/>, <say-as/> where appropriate.
- Replace symbols with spoken equivalents and expand common abbreviations.
- Keep output concise and avoid inventing facts.

Return ONLY the SSML document.`;

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

/**
 * Clear any cached worker URL detection. Useful for tests and dev tooling.
 * This does not abort an in-flight resolution promise, but subsequent
 * calls to `resolveWorkerBaseUrl` will re-run the probe.
 */
export function clearWorkerBaseUrlCache(): void {
  cachedWorkerBaseUrl = null;
}

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
