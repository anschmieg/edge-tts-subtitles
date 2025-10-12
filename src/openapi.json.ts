export const openApiSpec = {
  openapi: '3.0.1',
  info: {
    title: 'Edge TTS Subtitles API',
    version: '0.1.0',
    description: 'Text-to-Speech endpoints with subtitle generation and prosody controls',
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
                  input: { type: 'string' },
                  voice: { type: 'string' },
                  rate: { type: 'string' },
                  pitch: { type: 'string' },
                  volume: { type: 'string' },
                  raw_ssml: { type: 'string' },
                },
                required: ['input', 'voice'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'audio/mpeg binary' },
          '400': { description: 'Bad Request' },
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
                  input: { type: 'string' },
                  voice: { type: 'string' },
                  subtitle_format: { type: 'string', enum: ['srt', 'vtt'] },
                  rate: { type: 'string' },
                  pitch: { type: 'string' },
                  volume: { type: 'string' },
                  raw_ssml: { type: 'string' },
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
        },
      },
    },
  },
};
