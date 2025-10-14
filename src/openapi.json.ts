export const openApiSpec = {
  openapi: '3.0.1',
  info: {
    title: 'Edge TTS Subtitles API',
    version: '0.1.0',
    description: 'Text-to-Speech endpoints with subtitle generation and prosody controls. LLM preprocessing is available client-side in the demo UI.',
  },
  paths: {
    '/v1/audio/speech': {
      post: {
        summary: 'Synthesize speech (raw audio)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  input: { type: 'string', description: 'Text to convert to speech' },
                  voice: { type: 'string', description: 'Voice name (e.g., en-US-EmmaMultilingualNeural)' },
                  rate: { type: 'string', description: 'Speech rate (e.g., "1.0", "slow", "fast")' },
                  pitch: { type: 'string', description: 'Speech pitch (e.g., "+2st", "low", "high")' },
                  volume: { type: 'string', description: 'Speech volume (e.g., "medium", "loud")' },
                  raw_ssml: { type: 'string', description: 'Raw SSML markup (overrides other parameters)' },
                },
                required: ['input', 'voice'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'audio/mpeg binary' },
          '400': { description: 'Bad Request' },
          '500': { description: 'Internal Server Error' },
        },
      },
    },
    '/v1/audio/speech_subtitles': {
      post: {
        summary: 'Synthesize speech and return base64 audio + subtitles',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  input: { type: 'string', description: 'Text to convert to speech' },
                  voice: { type: 'string', description: 'Voice name (e.g., en-US-EmmaMultilingualNeural)' },
                  subtitle_format: { type: 'string', enum: ['srt', 'vtt'], description: 'Subtitle format (default: srt)' },
                  rate: { type: 'string', description: 'Speech rate (e.g., "1.0", "slow", "fast")' },
                  pitch: { type: 'string', description: 'Speech pitch (e.g., "+2st", "low", "high")' },
                  volume: { type: 'string', description: 'Speech volume (e.g., "medium", "loud")' },
                  raw_ssml: { type: 'string', description: 'Raw SSML markup (overrides other parameters)' },
                },
                required: ['input', 'voice'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'JSON with base64 audio and subtitle content',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          '400': { description: 'Bad Request' },
          '500': { description: 'Internal Server Error' },
        },
      },
    },
  },
};
