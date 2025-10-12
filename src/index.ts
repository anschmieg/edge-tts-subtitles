import { EdgeTTS, createSRT, createVTT } from 'edge-tts-universal/isomorphic';
import type { TTSRequest } from './types';

/**
 * Helper function to convert ArrayBuffer to Base64
 * @param buffer - ArrayBuffer to convert
 * @returns Base64-encoded string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Handle CORS preflight requests
 */
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

/**
 * Main Worker fetch handler
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return handleOptions();
		}

		const url = new URL(request.url);
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
		};

		try {
			switch (url.pathname) {
				case '/v1/audio/speech': {
					// OpenAI-compatible endpoint
					if (request.method !== 'POST') {
						return new Response(JSON.stringify({ error: 'Method not allowed' }), {
							status: 405,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}

					const body = (await request.json()) as TTSRequest;
					
					// Validate required fields
					if (!body.input || !body.voice) {
						return new Response(JSON.stringify({ error: 'Missing required fields: input and voice' }), {
							status: 400,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}

					// Create TTS instance and synthesize
					const tts = new EdgeTTS(body.input, body.voice);
					const result = await tts.synthesize();

					// Return raw audio as MP3
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
					// Custom subtitles endpoint
					if (request.method !== 'POST') {
						return new Response(JSON.stringify({ error: 'Method not allowed' }), {
							status: 405,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}

					const body = (await request.json()) as TTSRequest;
					
					// Validate required fields
					if (!body.input || !body.voice) {
						return new Response(JSON.stringify({ error: 'Missing required fields: input and voice' }), {
							status: 400,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}

					// Default to SRT if not specified
					const subtitleFormat = body.subtitle_format || 'srt';

					// Create TTS instance and synthesize
					const tts = new EdgeTTS(body.input, body.voice);
					const result = await tts.synthesize();

					// Convert audio to base64
					const audioBuffer = await result.audio.arrayBuffer();
					const audioContentBase64 = arrayBufferToBase64(audioBuffer);

					// Generate subtitle content based on format
					const subtitleContent = subtitleFormat === 'vtt' 
						? createVTT(result.subtitle)
						: createSRT(result.subtitle);

					// Return JSON response
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
					message: error instanceof Error ? error.message : String(error)
				}),
				{
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				}
			);
		}
	},
};
