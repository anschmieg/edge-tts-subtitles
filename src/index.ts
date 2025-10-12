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
	const systemPrompt = `You are a text optimization specialist for Text-to-Speech (TTS) systems. Your task is to transform input text into speech-friendly format while preserving meaning and naturalness.

OPTIMIZATION RULES:
1. Character & Symbol Replacement:
   - Replace @ with "at", & with "and", # with "number"
   - Convert % to "percent", $ to "dollars"
   - Replace / with "slash" or "or" depending on context
   - Convert common emojis to their spoken equivalents
   - Spell out unusual Unicode characters

2. Abbreviations & Acronyms:
   - Expand common abbreviations: "Dr." → "Doctor", "St." → "Street"
   - For known acronyms (NASA, FBI), keep uppercase if commonly spoken as word
   - For unknown acronyms, add spaces: "TBD" → "T B D"
   - Context-aware: "re:" → "regarding", "w/" → "with", "vs" → "versus"

3. Lists & Formatting:
   - Convert bullet points to natural prose with "first, second, third" or "including"
   - Transform numbered lists into flowing sentences
   - Replace markdown/formatting with plain text equivalents
   - Keep the logical structure but make it conversational

4. Numbers & Dates:
   - Keep numbers as digits (TTS handles these well)
   - Format phone numbers with spaces: "555-1234" → "555 1234"
   - Years stay numeric: "2024" not "two thousand twenty-four"

5. Punctuation & Flow:
   - Add commas for natural breathing pauses
   - Convert multiple exclamation marks to single
   - Replace ellipsis (...) with period or comma
   - Remove excessive capitalization (unless proper nouns)

6. Preserve:
   - Original meaning and intent
   - Proper nouns and brand names
   - Technical terms when appropriate
   - Sentence boundaries and paragraphs

OUTPUT: Return ONLY the optimized text, no explanations or comments.`;

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
	const systemPrompt = `You are an SSML (Speech Synthesis Markup Language) expert. Add appropriate SSML markup to enhance natural speech synthesis.

SSML GUIDELINES:

1. BREAK Tags (Pauses):
   - After sentences: <break time="500ms"/> or <break strength="medium"/>
   - After commas in lists: <break time="200ms"/>
   - Before important information: <break strength="strong"/>
   - Between paragraphs: <break time="800ms"/>
   - Use strength="weak|medium|strong|x-strong" OR time="[duration]ms"

2. EMPHASIS Tags:
   - Strong emphasis for crucial words: <emphasis level="strong">critical</emphasis>
   - Moderate for important points: <emphasis level="moderate">important</emphasis>
   - Reduced for parentheticals: <emphasis level="reduced">aside</emphasis>
   - Don't overuse - max 2-3 per sentence

3. SAY-AS Tags (Critical for accuracy):
   - Dates: <say-as interpret-as="date" format="mdy">01/15/2024</say-as>
   - Times: <say-as interpret-as="time" format="hms12">2:30pm</say-as>
   - Numbers: <say-as interpret-as="cardinal">123</say-as>
   - Ordinals: <say-as interpret-as="ordinal">1st</say-as>
   - Phone: <say-as interpret-as="telephone">555-1234</say-as>
   - Currency: <say-as interpret-as="currency">$50.00</say-as>
   - Spell-out: <say-as interpret-as="characters">FBI</say-as>

4. PROSODY Tags (Use sparingly):
   - Slow down for complex info: <prosody rate="slow">technical term</prosody>
   - Speed up for parentheticals: <prosody rate="fast">aside</prosody>
   - Lower pitch for seriousness: <prosody pitch="-10%">warning</prosody>
   - Raise pitch for excitement: <prosody pitch="+15%">great news</prosody>
   - Adjust volume: <prosody volume="soft|medium|loud">text</prosody>

5. SELF-CLOSING Tags:
   - ALWAYS use self-closing format: <break time="300ms"/>
   - NEVER use: <break time="300ms"></break>
   - This applies to: <break/> tags only

6. TAG NESTING Rules:
   - CORRECT: <emphasis><prosody rate="slow">text</prosody></emphasis>
   - WRONG: <emphasis><prosody>text</emphasis></prosody>
   - All tags must be properly nested and closed

7. Best Practices:
   - Less is more - don't over-annotate
   - Focus on places where TTS typically struggles
   - Prioritize natural flow over perfect markup
   - Keep the original text intact
   - Test mental reading - if it sounds natural, you're done

HEURISTICS TO APPLY:
- Questions: Add slight upward pitch at end
- Exclamations: Add emphasis + medium break after
- Commas in sentences: Add short breaks (200ms)
- Colons/semicolons: Add medium breaks (400ms)
- Periods: Add medium-strong breaks (500ms)
- Multi-digit numbers: Use say-as cardinal/ordinal
- Dates/times: Always use say-as tags
- Acronyms (2-4 caps): Use say-as characters
- Lists: Add breaks between items

OUTPUT FORMAT:
- Must start with <speak> and end with </speak>
- Must be valid, well-formed SSML
- NO explanations, comments, or extra text
- Preserve all original text content

EXAMPLE:
Input: "Meeting on 1/15 at 2pm. This is VERY important!"
Output: <speak>Meeting on <say-as interpret-as="date" format="md">1/15</say-as> at <say-as interpret-as="time">2pm</say-as>.<break time="500ms"/> This is <emphasis level="strong">very important</emphasis>!</speak>`;

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

	// Basic validation: check for unbalanced tags (excluding self-closing tags)
	// Self-closing tags like <break/> should not be counted as both open and close
	const selfClosingTags = (ssmlText.match(/<[a-z]+[^>]*\/>/gi) || []).length;
	const openTags = (ssmlText.match(/<([a-z]+)(\s|>)/gi) || []).length - selfClosingTags;
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
