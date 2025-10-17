/**
 * Utilities for working with SSML strings in the UI.
 *
 * Primary purpose: extract human-readable text from SSML for subtitle display
 * and downloads so markup isn't shown verbatim in the UI.
 */

export function extractTextFromSsml(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // Prefer DOMParser in browser contexts to properly parse SSML/XML.
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'application/xml');
      const parserErrors = doc.getElementsByTagName('parsererror');
      if (parserErrors && parserErrors.length > 0) {
        // Fall back to tag-stripping if parsing fails
        return fallbackStripTags(trimmed);
      }

      // Use textContent of the document to get natural text with entities decoded
      const text = doc.documentElement ? doc.documentElement.textContent || '' : doc.textContent || '';
      return normalizeWhitespace(text);
    } catch {
      return fallbackStripTags(trimmed);
    }
  }

  return fallbackStripTags(trimmed);
}

function fallbackStripTags(str: string): string {
  // Very permissive tag stripper for environments without DOMParser
  // Remove anything that looks like an angle-bracket tag first.
  let out = str.replace(/<[^>]*>/g, ' ');

  // If the worker returned tokenized SSML or dropped brackets we may see
  // concatenated tokens like "speakprosody rate100" or "volumemediumHello".
  // Apply heuristics to split common boundaries and remove known SSML tokens.

  // Split camelCase boundaries: fooBar -> foo Bar
  out = out.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Split letter-number and number-letter boundaries: a1 -> a 1, 100ms -> 100 ms
  out = out.replace(/([A-Za-z])([0-9])/g, '$1 $2');
  out = out.replace(/([0-9])([A-Za-z])/g, '$1 $2');

  // Remove common SSML token words that may have survived sanitization
  // e.g. speak, prosody, rate, pitch, volume, say-as, break, emphasis
  out = out.replace(/\b(speak|prosody|rate|pitch|volume|say-as|sayas|break|emphasis|interpret-as|characters|date|time|currency|telephone|cardinal|ordinal)\b/gi, ' ');

  // Also remove patterns like rate100 or pitch0st (word immediately followed by digits/units)
  out = out.replace(/\b(rate|pitch|volume)\s*[:=]?\s*([+-]?\d+\w*)\b/gi, '$2');

  // Remove leftover equals, quotes, slashes or attribute-like remnants
  out = out.replace(/[="'<>\/]+/g, ' ');

  return normalizeWhitespace(out);
}

function normalizeWhitespace(s: string | null): string {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim();
}
