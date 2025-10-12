// Request interface for TTS endpoints
export interface TTSRequest {
	input: string;
	voice: string;
	subtitle_format?: 'srt' | 'vtt';
	// Optional prosody controls (values expected as CSS-like strings or numeric where appropriate)
	rate?: string; // e.g. '1.0', '1.2', or 'slow', 'fast'
	pitch?: string; // e.g. '+2st', '-1st', 'low', 'high'
	volume?: string; // e.g. 'silent', 'x-soft', 'medium', 'loud'
	// Optional: allow callers to supply raw SSML if they want more control. If provided, server will use it directly.
	raw_ssml?: string;
	// Optional LLM preprocessing parameters
	llm_api_key?: string; // API key for OpenAI-compatible endpoint
	llm_endpoint?: string; // OpenAI-compatible endpoint URL
	optimize_for_tts?: boolean; // Enable text optimization for TTS
	add_ssml_markup?: boolean; // Enable SSML markup generation
}
