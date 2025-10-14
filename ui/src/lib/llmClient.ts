import { OPTIMIZE_FOR_TTS_PROMPT, ADD_SSML_MARKUP_PROMPT } from '../constants';

export interface LLMConfig {
  endpoint: string;
  apiKey: string;
  model?: string;
  timeout?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature: number;
}

export interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Validate LLM endpoint URL
 */
export function validateLLMEndpoint(endpoint: string): { valid: boolean; error?: string } {
  if (!endpoint) {
    return { valid: false, error: 'LLM endpoint is required' };
  }

  if (!endpoint.startsWith('https://')) {
    return { valid: false, error: 'LLM endpoint must start with https://' };
  }

  try {
    new URL(endpoint);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate SSML response
 */
export function validateSSML(content: string): { valid: boolean; error?: string } {
  if (!content.trim().startsWith('<speak>')) {
    return { valid: false, error: 'SSML must start with <speak>' };
  }

  if (!content.trim().endsWith('</speak>')) {
    return { valid: false, error: 'SSML must end with </speak>' };
  }

  // Basic tag balance check
  const openTags = content.match(/<([a-z-]+)(?:\s|>)/gi) || [];
  const closeTags = content.match(/<\/([a-z-]+)>/gi) || [];
  const selfClosingTags = content.match(/<[^>]+\/>/g) || [];

  // Count non-self-closing open tags
  const nonSelfClosingOpenCount = openTags.length - selfClosingTags.length;

  if (nonSelfClosingOpenCount !== closeTags.length) {
    return { 
      valid: false, 
      error: `Tag mismatch: ${nonSelfClosingOpenCount} opening tags, ${closeTags.length} closing tags` 
    };
  }

  return { valid: true };
}

/**
 * Call LLM API with timeout and validation
 * 
 * TODO: Wire this function to your LLM provider. Example implementation:
 * 
 * const response = await fetch(config.endpoint, {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${config.apiKey}`,
 *   },
 *   body: JSON.stringify({
 *     model: config.model || 'gpt-3.5-turbo',
 *     messages: [
 *       { role: 'system', content: systemPrompt },
 *       { role: 'user', content: userText }
 *     ],
 *     temperature: 0.2,
 *   }),
 *   signal: abortController.signal,
 * });
 */
export async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  userText: string
): Promise<string> {
  const validation = validateLLMEndpoint(config.endpoint);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const timeout = config.timeout || 15000; // Default 15s timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeout);

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
        temperature: 0.2,
      } as LLMRequest),
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errorText}`);
    }

    const data: LLMResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from LLM');
    }

    return data.choices[0].message.content;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM request timed out');
    }
    throw error;
  }
}

/**
 * Optimize text for TTS using LLM
 */
export async function optimizeTextForTTS(
  config: LLMConfig,
  text: string
): Promise<string> {
  const result = await callLLM(config, OPTIMIZE_FOR_TTS_PROMPT, text);
  
  if (!result.trim()) {
    throw new Error('LLM returned empty response');
  }
  
  return result.trim();
}

/**
 * Add SSML markup to text using LLM
 */
export async function addSSMLMarkup(
  config: LLMConfig,
  text: string
): Promise<string> {
  const result = await callLLM(config, ADD_SSML_MARKUP_PROMPT, text);
  
  const validation = validateSSML(result);
  if (!validation.valid) {
    throw new Error(`Invalid SSML response: ${validation.error}`);
  }
  
  return result.trim();
}
