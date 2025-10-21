import { MOCK_PAYLOAD, resolveWorkerBaseUrl } from '../constants';
import { MOCK_SUBTITLE_CONTENT, MOCK_AUDIO_BASE64 } from '../constants';

export interface WorkerVoice {
  shortName: string;
  friendlyName: string;
  locale: string;
  language: string;
  gender: 'Female' | 'Male';
  isMultilingual: boolean;
  displayName: string;
}

export interface TTSRequest {
  input: string;
  voice: string;
  subtitle_format?: 'srt' | 'vtt';
  rate?: string;
  pitch?: string;
  volume?: string;
  raw_ssml?: string;
}

export interface TTSResponse {
  audio_content_base64: string;
  subtitle_format: 'srt' | 'vtt';
  subtitle_content: string;
}

/**
 * Convert base64 string to Blob for audio playback
 */
export function base64ToBlob(base64: string, mimeType = 'audio/mpeg'): Blob {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Create an object URL from base64 audio data
 */
export function createAudioURL(base64Audio: string): string {
  const blob = base64ToBlob(base64Audio);
  return URL.createObjectURL(blob);
}

/**
 * Call the worker API to generate speech and subtitles
 */
export async function generateSpeechWithSubtitles(
  request: TTSRequest,
  mockMode = false
): Promise<TTSResponse> {
  if (mockMode) {
    // Return mock data for development
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(MOCK_PAYLOAD);
      }, 1000);
    });
  }
  try {
    const baseUrl = await resolveWorkerBaseUrl();
    const response = await fetch(`${baseUrl}/v1/audio/speech_subtitles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Worker API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (err) {
    // In development, when the worker is unreachable, fall back to a
    // lightweight mock payload so the UI remains usable. Re-throw in
    // production to surface failures.
    // Detect dev by checking import.meta.env if available.
    const isProd = typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.PROD);
    if (isProd) throw err;
    // Provide a minimal mock response so playback and downloads work.
    return Promise.resolve({
      audio_content_base64: MOCK_AUDIO_BASE64,
      subtitle_format: 'srt',
      subtitle_content: MOCK_SUBTITLE_CONTENT,
    });
  }
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download base64 audio as MP3 file
 */
export function downloadAudio(base64Audio: string, filename = 'speech.mp3'): void {
  const blob = base64ToBlob(base64Audio);
  downloadBlob(blob, filename);
}

/**
 * Download subtitle content as file
 */
export function downloadSubtitle(content: string, format: 'srt' | 'vtt', filename?: string): void {
  const defaultFilename = filename || `subtitles.${format}`;
  const blob = new Blob([content], { type: 'text/plain' });
  downloadBlob(blob, defaultFilename);
}

let voicesPromise: Promise<WorkerVoice[]> | null = null;

async function fetchVoicesOnce(): Promise<WorkerVoice[]> {
  try {
    const baseUrl = await resolveWorkerBaseUrl();
    const response = await fetch(`${baseUrl}/v1/voices`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load voices: ${response.status} - ${errorText}`);
    }

    const payload = await response.json();
    if (!payload || !Array.isArray(payload.voices)) {
      throw new Error('Unexpected voice payload');
    }

    return payload.voices as WorkerVoice[];
  } catch (err) {
    const isProd = typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.PROD);
    if (isProd) throw err;
    // Development fallback: return an empty array or a tiny mock set so the
    // UI doesn't break when the worker is not running locally.
    return [
      {
        shortName: 'en-US-EmmaMultilingualNeural',
        friendlyName: 'Emma (Multilingual)',
        locale: 'en-US',
        language: 'en',
        gender: 'Female',
        isMultilingual: true,
        displayName: 'Emma',
      },
    ];
  }
}

export async function fetchVoices(): Promise<WorkerVoice[]> {
  if (!voicesPromise) {
    voicesPromise = fetchVoicesOnce().catch((error) => {
      voicesPromise = null;
      throw error;
    });
  }
  return voicesPromise;
}
