/**
 * Client-side SSML validator using DOMParser when available.
 * Exports a simple validate function that returns { valid, error }
 * and an assertValid function that throws on invalid input and returns
 * the trimmed content on success.
 */
export function validateSsml(content: string): { valid: boolean; error?: string } {
  if (!content || !content.trim()) {
    return { valid: false, error: 'Empty SSML content' };
  }

  const trimmed = content.trim();

  // Fast checks for speak root
  if (!trimmed.startsWith('<speak') && !trimmed.startsWith('<speak>')) {
    return { valid: false, error: 'SSML must start with <speak>' };
  }
  if (!trimmed.endsWith('</speak>')) {
    return { valid: false, error: 'SSML must end with </speak>' };
  }

  // Prefer DOMParser in browsers for robust XML parsing
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'application/xml');
      // Some browsers add <parsererror> nodes on parse failure
      const parserErrors = doc.getElementsByTagName('parsererror');
      if (parserErrors && parserErrors.length > 0) {
        return { valid: false, error: 'XML parse error in SSML' };
      }

      const root = doc.documentElement;
      if (!root || root.nodeName.toLowerCase() !== 'speak') {
        return { valid: false, error: 'Root element must be <speak>' };
      }

      return { valid: true };
    } catch (err) {
      return { valid: false, error: `XML parse exception: ${String(err)}` };
    }
  }

  // Fallback: lightweight tag balance heuristic
  try {
    const openTags = trimmed.match(/<([a-zA-Z0-9:-]+)(?:\s|>)/g) || [];
    const closeTags = trimmed.match(/<\/([a-zA-Z0-9:-]+)>/g) || [];
    const selfClosing = trimmed.match(/<[^>]+\/>/g) || [];
    const nonSelfOpen = openTags.length - selfClosing.length;
    if (nonSelfOpen !== closeTags.length) {
      return { valid: false, error: 'Tag mismatch in SSML (heuristic)' };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: `SSML validation error: ${String(err)}` };
  }
}

export function assertValidSsml(content: string): string {
  const result = validateSsml(content);
  if (!result.valid) {
    throw new Error(result.error || 'Invalid SSML');
  }
  return content.trim();
}
