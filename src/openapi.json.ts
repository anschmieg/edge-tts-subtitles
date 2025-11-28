export const openApiSpec = {
  openapi: '3.0.1',
  info: {
    title: 'Edge TTS Subtitles API',
    version: '0.1.0',
    description: 'Text-to-Speech endpoints with subtitle generation and prosody controls. LLM preprocessing is available client-side in the demo UI.',
  },
  paths: {
    '/v1/voices': {
      get: {
        summary: 'List all available voices',
        description: 'Returns a list of all available text-to-speech voices with their properties including language, region, gender, and multilingual support.',
        responses: {
          '200': {
            description: 'List of voices',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    voices: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', description: 'Unique identifier for the voice' },
                          name: { type: 'string', description: 'Clean voice name (e.g., Emma)' },
                          language: { type: 'string', description: 'Language code (e.g., en)' },
                          region: { type: 'string', description: 'Region code (e.g., US)' },
                          gender: { type: 'string', enum: ['Male', 'Female'], description: 'Voice gender' },
                          isMultilingual: { type: 'boolean', description: 'Whether the voice supports multiple languages' },
                        },
                        required: ['id', 'name', 'language', 'region', 'gender', 'isMultilingual'],
                      },
                    },
                  },
                  required: ['voices'],
                },
              },
            },
          },
          '500': { description: 'Internal Server Error' },
        },
      },
    },
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
                  voice: { type: 'string', description: 'Voice name (e.g., en-US-EmmaMultilingualNeural). Defaults to en-US-EmmaMultilingualNeural if not provided or invalid.' },
                  rate: { type: 'string', description: 'Speech rate (e.g., "1.0", "slow", "fast")' },
                  pitch: { type: 'string', description: 'Speech pitch (e.g., "+2st", "low", "high")' },
                  volume: { type: 'string', description: 'Speech volume (e.g., "medium", "loud")' },
                  raw_ssml: { type: 'string', description: 'Raw SSML markup (overrides other parameters)' },
                },
                required: ['input'],
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
                  voice: { type: 'string', description: 'Voice name (e.g., en-US-EmmaMultilingualNeural). Defaults to en-US-EmmaMultilingualNeural if not provided or invalid.' },
                  subtitle_format: { type: 'string', enum: ['srt', 'vtt'], description: 'Subtitle format (default: srt)' },
                  rate: { type: 'string', description: 'Speech rate (e.g., "1.0", "slow", "fast")' },
                  pitch: { type: 'string', description: 'Speech pitch (e.g., "+2st", "low", "high")' },
                  volume: { type: 'string', description: 'Speech volume (e.g., "medium", "loud")' },
                  raw_ssml: { type: 'string', description: 'Raw SSML markup (overrides other parameters)' },
                },
                required: ['input'],
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
