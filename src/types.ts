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
}
