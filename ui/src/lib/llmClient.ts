import { OPTIMIZE_FOR_TTS_PROMPT, ADD_SSML_MARKUP_PROMPT, DIRECT_SSML_PROMPT } from '../constants';
import { assertValidSsml } from './validateSsml';

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
  // Up to 2 attempts: initial + one retry with explicit correction instruction.
  let attempt = 0;
  let lastError: string | undefined;
  while (attempt < 2) {
    attempt += 1;
    const result = await callLLM(config, ADD_SSML_MARKUP_PROMPT, text);
    try {
      // assertValidSsml uses DOMParser when available for robust validation
      return assertValidSsml(result);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt >= 2) break;
      // Provide a short corrective hint to the model for the retry.
      const hint = `The previous output contained malformed or invalid SSML: ${lastError}. Return only valid SSML that starts with <speak> and ends with </speak>. Do not include any explanation.`;
      // On retry, ask the model again with the hint and the original text.
      await callLLM(config, ADD_SSML_MARKUP_PROMPT, `${hint}

${text}`);
    }
  }

  throw new Error(`Invalid SSML response after retries: ${lastError}`);
}

/**
 * Generate direct SSML in a fully-automatic flow. Validates the returned
 * SSML and retries once with an instruction to fix invalid XML if needed.
 */
export async function generateDirectSSML(
  config: LLMConfig,
  text: string
): Promise<string> {
  // Try up to 2 times: first best-effort, then retry with correction hint.
  let lastError: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const systemPrompt = DIRECT_SSML_PROMPT;
    const userPayload = attempt === 0 ? text : `The previous output was invalid SSML: ${lastError}. Return only valid SSML that starts with <speak> and ends with </speak>. Do not include any explanation.

${text}`;
    const result = await callLLM(config, systemPrompt, userPayload);
    try {
      return assertValidSsml(result);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // continue to next attempt
    }
  }

  throw new Error(`LLM produced invalid SSML after retries: ${lastError}`);
}
