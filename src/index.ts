import { EdgeTTS, createSRT, createVTT } from 'edge-tts-universal/isomorphic';
import type { TTSRequest } from './types';
import { demoHtml } from './demo';
import { openApiSpec } from './openapi.json';
import { swaggerHtml } from './swagger-ui';

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

function escapeXml(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
}

/**
 * Call OpenAI-compatible LLM endpoint to optimize text for TTS
 */
async function optimizeTextForTTS(text: string, apiKey: string, endpoint: string): Promise<string> {
	const systemPrompt = `You are a text optimization assistant for Text-to-Speech (TTS) systems. Your task is to optimize the input text for natural and clear TTS output while preserving the original meaning and intent.

Guidelines:
1. Replace uncommon characters, symbols, and special formatting with their spoken equivalents
2. Simplify complex lists and bullet points to natural prose without being overly invasive
3. Expand abbreviations and acronyms where appropriate for clarity
4. Fix obvious typos and formatting issues
5. Ensure punctuation supports natural speech rhythm
6. Keep the text concise and conversational
7. Do NOT change the fundamental meaning or remove important information
8. Do NOT add extra commentary or explanations
9. Return ONLY the optimized text, nothing else

Output the optimized text directly without any preamble or explanation.`;

	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: 'gpt-3.5-turbo',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: text }
			],
			temperature: 0.3,
			max_tokens: 2000,
		}),
	});

	if (!response.ok) {
		throw new Error(`LLM API request failed: ${response.status} ${response.statusText}`);
	}

	const data = await response.json() as any;
	const optimizedText = data.choices?.[0]?.message?.content?.trim();
	
	if (!optimizedText) {
		throw new Error('LLM API returned invalid response: no content');
	}

	return optimizedText;
}

/**
 * Call OpenAI-compatible LLM endpoint to add SSML markup
 */
async function addSSMLMarkup(text: string, apiKey: string, endpoint: string): Promise<string> {
	const systemPrompt = `You are an SSML (Speech Synthesis Markup Language) expert. Your task is to add appropriate SSML markup to the input text to enforce natural pronunciation that aligns with the grammar and semantics of the text.

Guidelines:
1. Use <break> tags for natural pauses (time="300ms", strength="medium", etc.)
2. Use <emphasis> tags for important words (level="strong", "moderate", "reduced")
3. Use <prosody> tags to adjust rate, pitch, or volume for specific phrases when appropriate
4. Use <say-as> tags for dates, times, numbers, and other specialized content
5. Use <phoneme> tags ONLY when absolutely necessary for difficult pronunciations
6. DO NOT over-markup - keep it natural and readable
7. Ensure all SSML tags are properly closed and nested
8. The output must be valid SSML wrapped in <speak> tags
9. Preserve the original text content - only add markup
10. DO NOT add explanations or comments

Output ONLY the valid SSML markup, nothing else. The output must start with <speak> and end with </speak>.`;

	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: 'gpt-3.5-turbo',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: text }
			],
			temperature: 0.2,
			max_tokens: 3000,
		}),
	});

	if (!response.ok) {
		throw new Error(`LLM API request failed: ${response.status} ${response.statusText}`);
	}

	const data = await response.json() as any;
	let ssmlText = data.choices?.[0]?.message?.content?.trim();
	
	if (!ssmlText) {
		throw new Error('LLM API returned invalid response: no content');
	}

	// Validate SSML structure
	if (!ssmlText.startsWith('<speak>') || !ssmlText.endsWith('</speak>')) {
		throw new Error('LLM API returned invalid SSML: must be wrapped in <speak> tags');
	}

	// Basic validation: check for unbalanced tags
	const openTags = (ssmlText.match(/<([a-z]+)(\s|>)/gi) || []).length;
	const closeTags = (ssmlText.match(/<\/[a-z]+>/gi) || []).length;
	if (openTags !== closeTags) {
		throw new Error('LLM API returned invalid SSML: unbalanced tags detected');
	}

	return ssmlText;
}

// Normalize and validate prosody inputs
function normalizeRate(rate?: string): string | undefined {
	if (!rate) return undefined;
	const s = rate.trim().toLowerCase();
	// Allow keywords
	const keywords = new Set(['x-slow','slow','medium','fast','x-fast','default']);
	if (keywords.has(s)) return s;
	// If ends with % or contains letters, pass through
	if (/%$/.test(s) || /[a-z]/.test(s)) return s;
	// Numeric form like '1.2' -> '120%'
	const n = Number(s);
	if (!Number.isFinite(n)) return undefined;
	// Normalize: 1.0 -> 100%
	return Math.round(n * 100) + '%';
}

function normalizePitch(pitch?: string): string | undefined {
	if (!pitch) return undefined;
	const s = pitch.trim();
	// accept 'low', 'medium', 'high', numeric semitone offsets like '+2st' or '-1st'
	const keywords = new Set(['x-low','low','medium','high','x-high','default']);
	if (keywords.has(s.toLowerCase())) return s.toLowerCase();
	if (/^[+-]?\d+(\.\d+)?st$/.test(s)) return s; // semitone format
	// pass through if contains letters
	if (/[a-zA-Z]/.test(s)) return s;
	// numeric like '2' -> '+2st'
	const n = Number(s);
	if (!Number.isFinite(n)) return undefined;
	return (n >= 0 ? '+' : '') + n + 'st';
}

function normalizeVolume(volume?: string): string | undefined {
	if (!volume) return undefined;
	const s = volume.trim().toLowerCase();
	const keywords = new Set(['silent','x-soft','soft','medium','loud','x-loud','default']);
	if (keywords.has(s)) return s;
	// allow db values like '-6dB' or numeric percent
	if (/^-?\d+(\.\d+)?db$/.test(s)) return s;
	if (/%$/.test(s)) return s;
	// numeric 0-1 -> percent
	const n = Number(s);
	if (Number.isFinite(n)) return Math.round(n * 100) + '%';
	return undefined;
}

function handleOptions(): Response {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return handleOptions();
		}

		const url = new URL(request.url);
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
		};

		try {
			switch (url.pathname) {
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

					if (!body.input || !body.voice) {
						return new Response(JSON.stringify({ error: 'Missing required fields: input and voice' }), {
							status: 400,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}

					// LLM preprocessing if requested
					let processedInput = body.input;
					
					// Step 1: Optimize text for TTS if requested
					if (body.optimize_for_tts && body.llm_api_key && body.llm_endpoint) {
						try {
							processedInput = await optimizeTextForTTS(processedInput, body.llm_api_key, body.llm_endpoint);
						} catch (error) {
							return new Response(
								JSON.stringify({
									error: 'LLM text optimization failed',
									message: error instanceof Error ? error.message : String(error),
								}),
								{
									status: 500,
									headers: { ...corsHeaders, 'Content-Type': 'application/json' },
								}
							);
						}
					}

					// Prepare SSML if prosody parameters are provided
					let ttsInput = processedInput;
					if (body.raw_ssml) {
						ttsInput = body.raw_ssml;
					} else if (body.add_ssml_markup && body.llm_api_key && body.llm_endpoint) {
						// Step 2: Add SSML markup if requested
						try {
							ttsInput = await addSSMLMarkup(processedInput, body.llm_api_key, body.llm_endpoint);
						} catch (error) {
							return new Response(
								JSON.stringify({
									error: 'LLM SSML markup generation failed',
									message: error instanceof Error ? error.message : String(error),
								}),
								{
									status: 500,
									headers: { ...corsHeaders, 'Content-Type': 'application/json' },
								}
							);
						}
					} else if (body.rate || body.pitch || body.volume) {
						const r = normalizeRate(body.rate);
						const p = normalizePitch(body.pitch);
						const v = normalizeVolume(body.volume);
						const rateAttr = r ? ` rate=\"${r}\"` : '';
						const pitchAttr = p ? ` pitch=\"${p}\"` : '';
						const volumeAttr = v ? ` volume=\"${v}\"` : '';
						ttsInput = `<speak><prosody${rateAttr}${pitchAttr}${volumeAttr}>${escapeXml(processedInput)}</prosody></speak>`;
					}

					const tts = new EdgeTTS(ttsInput, body.voice);
					const result = await tts.synthesize();

					const audioBuffer = await result.audio.arrayBuffer();
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

					if (!body.input || !body.voice) {
						return new Response(JSON.stringify({ error: 'Missing required fields: input and voice' }), {
							status: 400,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}

					const subtitleFormat = body.subtitle_format || 'srt';

					// LLM preprocessing if requested
					let processedInput = body.input;
					
					// Step 1: Optimize text for TTS if requested
					if (body.optimize_for_tts && body.llm_api_key && body.llm_endpoint) {
						try {
							processedInput = await optimizeTextForTTS(processedInput, body.llm_api_key, body.llm_endpoint);
						} catch (error) {
							return new Response(
								JSON.stringify({
									error: 'LLM text optimization failed',
									message: error instanceof Error ? error.message : String(error),
								}),
								{
									status: 500,
									headers: { ...corsHeaders, 'Content-Type': 'application/json' },
								}
							);
						}
					}

					// Prepare SSML for subtitles endpoint as well
					let ttsInput = processedInput;
					if (body.raw_ssml) {
						ttsInput = body.raw_ssml;
					} else if (body.add_ssml_markup && body.llm_api_key && body.llm_endpoint) {
						// Step 2: Add SSML markup if requested
						try {
							ttsInput = await addSSMLMarkup(processedInput, body.llm_api_key, body.llm_endpoint);
						} catch (error) {
							return new Response(
								JSON.stringify({
									error: 'LLM SSML markup generation failed',
									message: error instanceof Error ? error.message : String(error),
								}),
								{
									status: 500,
									headers: { ...corsHeaders, 'Content-Type': 'application/json' },
								}
							);
						}
					} else if (body.rate || body.pitch || body.volume) {
						const r = normalizeRate(body.rate);
						const p = normalizePitch(body.pitch);
						const v = normalizeVolume(body.volume);
						const rateAttr = r ? ` rate=\"${r}\"` : '';
						const pitchAttr = p ? ` pitch=\"${p}\"` : '';
						const volumeAttr = v ? ` volume=\"${v}\"` : '';
						ttsInput = `<speak><prosody${rateAttr}${pitchAttr}${volumeAttr}>${escapeXml(processedInput)}</prosody></speak>`;
					}

					const tts = new EdgeTTS(ttsInput, body.voice);
					const result = await tts.synthesize();

					const audioBuffer = await result.audio.arrayBuffer();
					const audioContentBase64 = arrayBufferToBase64(audioBuffer);

					const subtitleContent = subtitleFormat === 'vtt' ? createVTT(result.subtitle) : createSRT(result.subtitle);

					return new Response(
						JSON.stringify({
							audio_content_base64: audioContentBase64,
							subtitle_format: subtitleFormat,
							subtitle_content: subtitleContent,
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
