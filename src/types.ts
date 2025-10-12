// Request interface for TTS endpoints
export interface TTSRequest {
	input: string;
	voice: string;
	subtitle_format?: 'srt' | 'vtt';
}
