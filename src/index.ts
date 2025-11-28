import { EdgeTTS, createSRT, createVTT, listVoices } from 'edge-tts-universal/isomorphic';
import type { TTSRequest } from './types';
import { demoHtml } from './demo';
import { openApiSpec } from './openapi.json';
import { swaggerHtml } from './swagger-ui';
import { validateRawSsml, stripSsmlTags, ssmlToPlainText } from './lib/ssmlServer';
import type { Voice } from 'edge-tts-universal/isomorphic';

/**
 * Helper function to convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function formatPercentDelta(delta: number): string | undefined {
	const rounded = Math.round(delta);
	if (!Number.isFinite(rounded) || rounded === 0) {
		return undefined;
	}
	const clamped = clamp(rounded, -100, 100);
	return `${clamped > 0 ? '+' : ''}${clamped}%`;
}

function formatHzDelta(delta: number): string | undefined {
	const rounded = Math.round(delta);
	if (!Number.isFinite(rounded) || rounded === 0) {
		return undefined;
	}
	const clamped = clamp(rounded, -1200, 1200);
	return `${clamped > 0 ? '+' : ''}${clamped}Hz`;
}

function mapRate(rate?: string): string | undefined {
	if (!rate) return undefined;
	const raw = rate.trim();
	if (!raw) return undefined;
	const value = raw.toLowerCase();
	const neutral = new Set(['1', '1.0', '1.00', '1x', 'normal', 'default', 'medium', '100%']);
	if (neutral.has(value)) return undefined;

	const keywordMap: Record<string, number> = {
		'x-slow': -60,
		'slow': -20,
		'medium': 0,
		'normal': 0,
		'fast': 20,
		'very fast': 40,
		'x-fast': 60,
		'default': 0,
	};
	if (keywordMap[value] !== undefined) {
		return formatPercentDelta(keywordMap[value]);
	}

	const percentMatch = value.match(/^([+-]?\d+(?:\.\d+)?)%$/);
	if (percentMatch) {
		const num = Number(percentMatch[1]);
		if (!Number.isFinite(num)) return undefined;
		if (value.startsWith('+') || value.startsWith('-')) {
			return formatPercentDelta(num);
		}
		return formatPercentDelta(num - 100);
	}

	const factorMatch = value.match(/^([+-]?\d+(?:\.\d+)?)x$/);
	if (factorMatch) {
		const factor = Number(factorMatch[1]);
		if (!Number.isFinite(factor)) return undefined;
		return formatPercentDelta((factor - 1) * 100);
	}

	const numeric = Number(value);
	if (Number.isFinite(numeric)) {
		return formatPercentDelta((numeric - 1) * 100);
	}

	return undefined;
}

function mapPitch(pitch?: string): string | undefined {
	if (!pitch) return undefined;
	const raw = pitch.trim();
	if (!raw) return undefined;
	const value = raw.toLowerCase();
	const neutral = new Set(['0', '+0', '-0', '0st', '+0st', '-0st', '0hz', '+0hz', '-0hz', 'default', 'medium', 'normal']);
	if (neutral.has(value)) return undefined;

	const keywordMap: Record<string, number> = {
		'x-low': -600,
		'low': -300,
		'medium': 0,
		'high': 300,
		'x-high': 600,
	};
	if (keywordMap[value] !== undefined) {
		return formatHzDelta(keywordMap[value]);
	}

	const semitoneMatch = value.match(/^([+-]?\d+(?:\.\d+)?)st$/);
	if (semitoneMatch) {
		const semitones = Number(semitoneMatch[1]);
		if (!Number.isFinite(semitones)) return undefined;
		// Rough conversion: 1 semitone ≈ 100 Hz adjustment
		return formatHzDelta(semitones * 100);
	}

	const hzMatch = value.match(/^([+-]?\d+(?:\.\d+)?)hz$/);
	if (hzMatch) {
		const hz = Number(hzMatch[1]);
		if (!Number.isFinite(hz)) return undefined;
		return formatHzDelta(hz);
	}

	return undefined;
}

function mapVolume(volume?: string): string | undefined {
	if (!volume) return undefined;
	const raw = volume.trim();
	if (!raw) return undefined;
	const value = raw.toLowerCase();
	const neutral = new Set(['medium', 'default', 'normal', '0%', '+0%', '-0%', '0']);
	if (neutral.has(value)) return undefined;

	const keywordMap: Record<string, number> = {
		'silent': -100,
		'x-soft': -60,
		'soft': -20,
		'medium': 0,
		'loud': 20,
		'x-loud': 40,
	};
	if (keywordMap[value] !== undefined) {
		return formatPercentDelta(keywordMap[value]);
	}

	const percentMatch = value.match(/^([+-]?\d+(?:\.\d+)?)%$/);
	if (percentMatch) {
		const num = Number(percentMatch[1]);
		if (!Number.isFinite(num)) return undefined;
		if (value.startsWith('+') || value.startsWith('-')) {
			return formatPercentDelta(num);
		}
		return formatPercentDelta(num);
	}

	const dbMatch = value.match(/^([+-]?\d+(?:\.\d+)?)db$/);
	if (dbMatch) {
		const db = Number(dbMatch[1]);
		if (!Number.isFinite(db)) return undefined;
		// Approximate conversion: 1 dB ≈ 5% change
		return formatPercentDelta(db * 5);
	}

	const numeric = Number(value);
	if (Number.isFinite(numeric)) {
		return formatPercentDelta((numeric - 1) * 100);
	}

	return undefined;
}

function parseAllowedOrigins(env: any): string[] {
	const raw = env && env.ALLOWED_ORIGINS;
	if (raw && typeof raw === 'string') {
		return raw.split(',').map((s) => s.trim()).filter(Boolean);
	}
	// sensible defaults: production Pages and the worker host plus localhost for local dev
	return [
		'https://tts-sub.pages.dev',
		'https://edge-tts-subtitles.s-x.workers.dev',
		'http://localhost:8787',
		'http://127.0.0.1:8787',
	];
}

function originMatchesPattern(originUrl: URL, pattern: string): boolean {
	// pattern can be a full origin (with protocol) or a host pattern like '*.pages.dev' or 'tts-sub.pages.dev'
	try {
		const p = pattern.trim();
		if (!p) return false;
		// If pattern looks like a full origin (has protocol), compare origin exactly or with wildcard host
		if (/^https?:\/\//i.test(p)) {
			const parsed = new URL(p);
			// exact match
			if (parsed.protocol === originUrl.protocol && parsed.host === originUrl.host) return true;
			// allow wildcard in hostname if pattern host starts with '*.'
			if (parsed.host.startsWith('*.')) {
				const suffix = parsed.host.slice(2);
				return originUrl.hostname === suffix || originUrl.hostname.endsWith('.' + suffix);
			}
			return false;
		}

		// Otherwise treat pattern as a host pattern
		if (p.startsWith('*.')) {
			const suffix = p.slice(2);
			return originUrl.hostname === suffix || originUrl.hostname.endsWith('.' + suffix);
		}

		// direct host match
		if (originUrl.hostname === p) return true;

		// allow direct host with port (p may include port)
		if (originUrl.host === p) return true;

		return false;
	} catch (e) {
		return false;
	}
}

function corsHeadersForOrigin(origin: string | null, env: any) {
	const allowed = parseAllowedOrigins(env);
	if (!origin) return null;
	let originUrl: URL;
	try {
		originUrl = new URL(origin);
	} catch (e) {
		return null;
	}

	for (const pattern of allowed) {
		if (originMatchesPattern(originUrl, pattern)) {
			return {
				'Access-Control-Allow-Origin': origin,
				'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type',
				// Make these CORS headers readable from page JS for debugging/visibility
				'Access-Control-Expose-Headers': 'Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers',
				'Access-Control-Max-Age': '86400',
			} as Record<string, string>;
		}
	}
	return null;
}

function handleOptions(origin: string | null, env: any): Response {
	const headers = corsHeadersForOrigin(origin, env) || {
		'Access-Control-Allow-Origin': 'null',
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Max-Age': '0',
	};
	return new Response(null, { status: 204, headers });
}

type VoiceSummary = {
	id: string;
	name: string;
	language: string;
	region: string;
	gender: Voice['Gender'];
	isMultilingual: boolean;
};

let cachedVoices: { expiresAt: number; data: VoiceSummary[] } | null = null;
const VOICE_CACHE_DURATION_MS = 1000 * 60 * 60 * 12; // 12 hours

// Default voice to use when no voice is specified or an invalid voice is provided
const DEFAULT_VOICE = 'en-US-EmmaMultilingualNeural';

async function getVoiceSummaries(): Promise<VoiceSummary[]> {
	const now = Date.now();
	if (cachedVoices && cachedVoices.expiresAt > now) {
		return cachedVoices.data;
	}

	const rawVoices = await listVoices();
	const summaries = rawVoices.map<VoiceSummary>((voice) => {
		const [language, region] = voice.Locale.split('-');
		const friendlyName = voice.FriendlyName || voice.ShortName;
		// Extract voice name from shortName: e.g., "af-ZA-AdriNeural" -> "Adri"
		const shortNameParts = voice.ShortName.split('-');
		const voiceNameRaw = shortNameParts[2] || voice.ShortName;
		const name = voiceNameRaw.replace(/Neural$/, '').replace(/Multilingual$/, '');
		const isMultilingual =
			/Multilingual/i.test(voice.ShortName) ||
			/Multilingual/i.test(voice.Name) ||
			/Multilingual/i.test(friendlyName);

		return {
			id: voice.ShortName,
			name,
			language: language || voice.Locale,
			region: region || '',
			gender: voice.Gender,
			isMultilingual,
		};
	});

	summaries.sort((a, b) => {
		if (a.language !== b.language) return a.language.localeCompare(b.language);
		if (a.region !== b.region) return a.region.localeCompare(b.region);
		return a.name.localeCompare(b.name);
	});

	cachedVoices = {
		expiresAt: now + VOICE_CACHE_DURATION_MS,
		data: summaries,
	};
	return summaries;
}

/**
 * Get the default multilingual voice from the provided voice list.
 * Returns the first available multilingual voice, preferring DEFAULT_VOICE if available.
 */
function getDefaultVoiceFromList(voices: VoiceSummary[]): string {
	// Prefer the configured default voice
	const preferred = voices.find((v) => v.shortName === DEFAULT_VOICE);
	if (preferred) {
		return preferred.shortName;
	}
	
	// Otherwise use the first multilingual voice
	const multilingual = voices.find((v) => v.isMultilingual);
	if (multilingual) {
		return multilingual.shortName;
	}
	
	// Fallback to the first available voice if no multilingual voices exist
	if (voices.length > 0) {
		return voices[0].shortName;
	}
	
	// Ultimate fallback - this should never happen but provides a safe default
	return DEFAULT_VOICE;
}

/**
 * Validate if a voice exists in the available voice list.
 * Returns the validated voice name if it exists, otherwise returns the default voice.
 */
async function validateAndGetVoice(requestedVoice?: string): Promise<string> {
	const voices = await getVoiceSummaries();
	
	// If no voice provided or voice doesn't exist, use default
	if (!requestedVoice || !requestedVoice.trim()) {
		return getDefaultVoiceFromList(voices);
	}
	
	const voiceExists = voices.some((v) => v.shortName === requestedVoice);
	if (!voiceExists) {
		return getDefaultVoiceFromList(voices);
	}
	
	return requestedVoice;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return handleOptions(request.headers.get('Origin'), env);
		}

		const url = new URL(request.url);
		const corsHeaders = corsHeadersForOrigin(request.headers.get('Origin'), env) || { 'Access-Control-Allow-Origin': 'null' };

		// Temporary debug endpoint: returns the request Origin header, the CORS
		// headers computed for that origin, and the configured allowlist. This
		// helps diagnose why some browsers may still see CORS errors.
		if (url.pathname === '/__debug') {
			const originHeader = request.headers.get('Origin');
			const computed = corsHeadersForOrigin(originHeader, env) || null;
			const allowed = parseAllowedOrigins(env);
			return new Response(JSON.stringify({ originHeader, computed, allowed }), {
				status: 200,
				headers: { ...(computed || { 'Access-Control-Allow-Origin': 'null' }), 'Content-Type': 'application/json' },
			});
		}

		try {
			switch (url.pathname) {
				case '/v1/voices': {
					if (request.method !== 'GET') {
						return new Response(JSON.stringify({ error: 'Method not allowed' }), {
							status: 405,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}

					try {
						const voices = await getVoiceSummaries();
						return new Response(JSON.stringify({ voices }), {
							status: 200,
							headers: {
								...corsHeaders,
								'Content-Type': 'application/json',
								'Cache-Control': 'public, max-age=3600',
							},
						});
					} catch (error) {
						console.error('Error fetching voice list:', error);
						return new Response(JSON.stringify({ error: 'Failed to load voice list' }), {
							status: 500,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}
				}

				case '/__health': {
					// Lightweight health endpoint for UI reachability probes.
					if (request.method === 'GET' || request.method === 'HEAD') {
						return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
					}
					break;
				}
				case '/': {
					if (request.method === 'GET') {
						return new Response(demoHtml, {
							status: 200,
							headers: { 'Content-Type': 'text/html; charset=utf-8' },
						});
					}
					break;
				}

				case '/v1/audio/speech': {
					if (request.method !== 'POST') {
						return new Response(JSON.stringify({ error: 'Method not allowed' }), {
							status: 405,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}

					const body = (await request.json()) as TTSRequest;

					if (!body.input) {
						return new Response(JSON.stringify({ error: 'Missing required field: input' }), {
							status: 400,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}

					// Validate and get voice - use default if not provided or invalid
					const voice = await validateAndGetVoice(body.voice);

					// Accept optional raw_ssml. If provided, use it directly as the
					// synthesis input. If it doesn't look like a full SSML document,
					// wrap it in a <speak> element so TTS engines that expect SSML
					// receive a well-formed document.

					const rateOption = mapRate(body.rate);
					const pitchOption = mapPitch(body.pitch);
					const volumeOption = mapVolume(body.volume);
					const prosodyOptions: { rate?: string; pitch?: string; volume?: string } = {};
					if (rateOption) prosodyOptions.rate = rateOption;
					if (pitchOption) prosodyOptions.pitch = pitchOption;
					if (volumeOption) prosodyOptions.volume = volumeOption;

					// Determine the input to pass to EdgeTTS. Prefer raw_ssml when
					// supplied by the caller (client-side LLM or advanced UI).
					const debugEnabled = Boolean(
						(env && ((env as any).DEBUG_SSML === '1' || (env as any).DEBUG_SSML === 'true')) ||
						(request.headers.get && request.headers.get('x-debug-ssml') === '1')
					);
					if (debugEnabled) {
						console.log('SSML debug: endpoint=/v1/audio/speech, raw_ssml present=', !!body.raw_ssml);
					}
					let synthesisInput = body.input;
					if (body.raw_ssml && typeof body.raw_ssml === 'string' && body.raw_ssml.trim()) {
						const validation = validateRawSsml(body.raw_ssml);
						if (!validation.ok) {
							return new Response(JSON.stringify({ error: `Invalid SSML: ${validation.error}` }), {
								status: 400,
								headers: { ...corsHeaders, 'Content-Type': 'application/json' },
							});
						}
						synthesisInput = validation.wrapped || body.raw_ssml.trim();
					}

					if (debugEnabled) {
						// Log a short preview to avoid leaking secrets; this helps verify
						// whether we're actually sending SSML to the TTS library.
						console.log('SSML debug: synthesisInput preview:', synthesisInput.slice(0, 200));
					}
					const tts = new EdgeTTS(synthesisInput, voice, prosodyOptions);
					const result = await tts.synthesize();

					const audioBuffer = await result.audio.arrayBuffer();
					if (debugEnabled) {
						console.log('SSML debug: /v1/audio/speech returned audio size bytes=', audioBuffer.byteLength);
					}
					return new Response(audioBuffer, {
						status: 200,
						headers: {
							...corsHeaders,
							'Content-Type': 'audio/mpeg',
						},
					});
				}

				case '/v1/audio/speech_subtitles': {
					if (request.method !== 'POST') {
						return new Response(JSON.stringify({ error: 'Method not allowed' }), {
							status: 405,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}

					const body = (await request.json()) as TTSRequest;

					if (!body.input) {
						return new Response(JSON.stringify({ error: 'Missing required field: input' }), {
							status: 400,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}

					// Validate and get voice - use default if not provided or invalid
					const voice = await validateAndGetVoice(body.voice);

					const subtitleFormat = body.subtitle_format || 'srt';

					const rateOption = mapRate(body.rate);
					const debugEnabled = Boolean(
						(env && ((env as any).DEBUG_SSML === '1' || (env as any).DEBUG_SSML === 'true')) ||
						(request.headers.get && request.headers.get('x-debug-ssml') === '1')
					);
					if (debugEnabled) {
						console.log('SSML debug: endpoint=/v1/audio/speech_subtitles, raw_ssml present=', !!body.raw_ssml);
					}
					const pitchOption = mapPitch(body.pitch);
					const volumeOption = mapVolume(body.volume);
					const prosodyOptions: { rate?: string; pitch?: string; volume?: string } = {};
					if (rateOption) prosodyOptions.rate = rateOption;
					if (pitchOption) prosodyOptions.pitch = pitchOption;
					if (volumeOption) prosodyOptions.volume = volumeOption;

					// Prefer raw_ssml when provided. Validate and wrap non-SSML
					// fragments in a <speak> element to produce valid SSML.
					let synthesisInput = body.input;
					let subtitleContentText: string | undefined;
					if (body.raw_ssml && typeof body.raw_ssml === 'string' && body.raw_ssml.trim()) {
						const validation = validateRawSsml(body.raw_ssml.trim());
						if (!validation.ok) {
							return new Response(JSON.stringify({ error: `Invalid SSML: ${validation.error}` }), {
								status: 400,
								headers: { ...corsHeaders, 'Content-Type': 'application/json' },
							});
						}
						synthesisInput = validation.wrapped || body.raw_ssml.trim();
						// produce a plain-text subtitle representation from SSML
						try {
							subtitleContentText = ssmlToPlainText(synthesisInput);
						} catch (e) {
							// non-fatal: leave subtitleContentText undefined if extraction fails
							subtitleContentText = undefined;
						}
					}



					if (debugEnabled) {
						console.log('SSML debug: synthesisInput preview:', synthesisInput.slice(0, 200));
					}
					const tts = new EdgeTTS(synthesisInput, voice, prosodyOptions);
					const result = await tts.synthesize();

					const audioBuffer = await result.audio.arrayBuffer();
					const audioContentBase64 = arrayBufferToBase64(audioBuffer);

					const subtitleContentRaw = subtitleFormat === 'vtt' ? createVTT(result.subtitle) : createSRT(result.subtitle);
					let subtitleContent: string;
					// If we produced a SSML-derived plain-text version (subtitleContentText),
					// prefer per-cue conversion so `subtitle_content` contains no SSML markup.
					if (subtitleContentText) {
						try {
							const cueSplit = (subtitleContentRaw || '').trim().split(/\r?\n\r?\n/);
							const timestampRe = /\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/;
							const cleanedBlocks = cueSplit.map(block => {
								const lines = block.split(/\r?\n/).map(l => l.trim());
								if (lines.length >= 2 && timestampRe.test(lines[1])) {
									const index = lines[0];
									const time = lines[1];
									const text = lines.slice(2).join(' ');
									// Use ssmlToPlainText for best fidelity; wrap in <speak> if needed.
									let cleaned = '';
									try {
										const candidate = text.trim().startsWith('<') ? text : `<speak>${text}</speak>`;
										cleaned = ssmlToPlainText(candidate) || '';
									} catch (e) {
										cleaned = stripSsmlTags(text);
									}
									return [index, time, cleaned].join('\n');
								}
								return stripSsmlTags(block);
							});
							subtitleContent = cleanedBlocks.join('\n\n').trim();
						} catch (e) {
							// On any failure, fall back to the previous conservative cleaner
							subtitleContent = stripSsmlTags(subtitleContentRaw || '');
						}
					} else {
						const raw = subtitleContentRaw || '';
						const hasMarkup = /<[a-zA-Z][\s\S]*?>/.test(raw);
						subtitleContent = hasMarkup ? stripSsmlTags(raw) : raw.trim();
					}
					if (debugEnabled) {
						console.log('SSML debug: subtitleContent preview:', (subtitleContentRaw || '').slice(0, 300));
					}

					return new Response(
						JSON.stringify({
							audio_content_base64: audioContentBase64,
							subtitle_format: subtitleFormat,
							subtitle_content: subtitleContent,
							subtitle_content_raw: subtitleContentRaw,
							subtitle_content_text: subtitleContentText,
						}),
						{
							status: 200,
							headers: {
								...corsHeaders,
								'Content-Type': 'application/json',
							},
						}
					);
				}

				case '/openapi.json': {
					if (request.method === 'GET') {
						return new Response(JSON.stringify(openApiSpec), {
							status: 200,
							headers: { 'Content-Type': 'application/json; charset=utf-8' },
						});
					}
					break;
				}

				case '/docs': {
					if (request.method === 'GET') {
						return new Response(swaggerHtml, {
							status: 200,
							headers: { 'Content-Type': 'text/html; charset=utf-8' },
						});
					}
					break;
				}

				default:
					return new Response(JSON.stringify({ error: 'Not found' }), {
						status: 404,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					});
			}
		} catch (error) {
			console.error('Error processing request:', error);
			return new Response(
				JSON.stringify({
					error: 'Internal server error',
					message: error instanceof Error ? error.message : String(error),
				}),
				{
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				}
			);
		}
		// Fallback
		return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
	},
};
