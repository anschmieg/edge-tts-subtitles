// Lightweight SSML validation and sanitization helpers for the worker.
// We avoid heavy XML parsing in the worker; use conservative checks
// to reject obviously-dangerous or malformed inputs.

const MAX_SSML_LENGTH = 32 * 1024; // 32 KB

// Tags we allow in SSML input. Keep this list conservative.
const ALLOWED_TAGS = new Set([
  'speak',
  'voice',
  'prosody',
  'break',
  'emphasis',
  'say-as',
  'phoneme',
  'sub',
  'p',
  's',
  'w',
  'lex',
]);

const forbiddenAudioTag = /<\s*audio\b[^>]*>/i;
const externalUriPattern = /(?:src|audio|href)\s*=\s*["']\s*(?:https?:)?\/\//i;

// fast-xml-parser for robust SSML parsing in the worker
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  trimValues: true,
});

/**
 * Simple tag extraction to discover used element names.
 */
function extractTagNames(ssml: string): string[] {
  const tags: string[] = [];
  const re = /<\/?\s*([a-zA-Z0-9:-]+)(?:\s|>|\/)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ssml))) {
    tags.push(m[1].toLowerCase());
  }
  return tags;
}

/**
 * Heuristic tag-balance check: counts non-self-closing open tags vs close tags.
 * Not perfect, but filters many malformed inputs.
 */
function hasBalancedTags(ssml: string): boolean {
  try {
    // Remove self-closing tags first
    const withoutSelfClosing = ssml.replace(/<[^>]+\/>/g, '');
    const open = (withoutSelfClosing.match(/<([a-zA-Z0-9:-]+)(?:\s|>)/g) || []).length;
    const close = (withoutSelfClosing.match(/<\/([a-zA-Z0-9:-]+)>/g) || []).length;
    return open === close;
  } catch (e) {
    return false;
  }
}

export function validateRawSsml(input: string): { ok: boolean; error?: string; wrapped?: string } {
  if (!input || typeof input !== 'string' || !input.trim()) {
    return { ok: false, error: 'Empty SSML' };
  }

  if (input.length > MAX_SSML_LENGTH) {
    return { ok: false, error: `SSML too long (max ${MAX_SSML_LENGTH} chars)` };
  }

  if (forbiddenAudioTag.test(input)) {
    return { ok: false, error: 'Forbidden tag <audio> detected in SSML' };
  }

  if (externalUriPattern.test(input)) {
    return { ok: false, error: 'External URIs not allowed in SSML attributes' };
  }

  // Use fast-xml-parser to validate XML/SSML structure
  try {
    const v = XMLValidator.validate(input);
    if (v !== true) {
      return { ok: false, error: `XML validation error: ${JSON.stringify(v)}` };
    }
  } catch (e) {
    return { ok: false, error: 'XML validation failed' };
  }

  // After XML validation, do a simple tag-name whitelist check using regex
  // extraction; this is robust and avoids complex AST traversal edge cases.
  const tags = extractTagNames(input);
  for (const t of tags) {
    if (!ALLOWED_TAGS.has(t)) {
      if (t === '?xml') continue;
      return { ok: false, error: `Disallowed SSML element: <${t}>` };
    }
  }

  const trimmed = input.trim();
  if (!/^<\s*speak\b/i.test(trimmed)) {
    return { ok: true, wrapped: `<speak>${trimmed}</speak>` };
  }
  return { ok: true, wrapped: trimmed };
}

/**
 * Strip SSML tags for subtitle/plaintext output. Uses DOMParser when
 * available in the environment, otherwise falls back to a conservative
 * tag-stripping regex.
 */
export function stripSsmlTags(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // If this looks like SRT or VTT (contains timestamps), parse cues and
  // only operate on the cue text lines so we don't mangle timestamps.
  const cueSplit = trimmed.split(/\r?\n\r?\n/);
  const timestampRe = /\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/;

  // Try to extract readable text using the XML parser to correctly honor
  // <break time="..."/> (we'll turn them into [pause ...]) and nested text.
  function extractTextWithParser(ssmlText: string): string | null {
    try {
      const v = XMLValidator.validate(ssmlText);
      if (v !== true) return null;
      const ast = xmlParser.parse(ssmlText);
      const outParts: string[] = [];

      function walk(nodes: any[]) {
        for (const node of nodes) {
          if (typeof node === 'string') {
            outParts.push(node);
            continue;
          }
          for (const k of Object.keys(node)) {
            if (k === '#text') {
              outParts.push(node[k]);
              continue;
            }
            const tag = k.toLowerCase();
            const val = node[k];
            if (tag === 'break') {
              // attempt to read a time attribute (fast-xml-parser uses '@_' prefix)
              let timeAttr: string | undefined;
              if (Array.isArray(val)) {
                for (const e of val) {
                  if (e && typeof e === 'object' && e[':@_time']) timeAttr = e[':@_time'];
                }
              } else if (val && typeof val === 'object' && val[':@_time']) {
                timeAttr = val[':@_time'];
              }
              if (timeAttr) outParts.push(`[pause ${timeAttr}]`);
              else outParts.push('[pause]');
              if (Array.isArray(val)) walk(val);
            } else {
              if (Array.isArray(val)) walk(val);
              else if (typeof val === 'string') outParts.push(val);
            }
          }
        }
      }

      walk(ast);
      let result = outParts.join(' ').replace(/\s+/g, ' ').trim();
      // Final cleanup: separate common tag tokens stuck to words (speakHello -> Hello)
      result = result.replace(/\bspeak\s+/gi, '');
      result = result.replace(/\btime\s*(\d+)/gi, '$1 ');
      // remove standalone 'break' tokens left behind
      result = result.replace(/\bbreak\b/gi, '');
      return result.trim();
    } catch (e) {
      return null;
    }
  }

  function cleanTextLine(text: string): string {
    const parsed = extractTextWithParser(`<speak>${text}</speak>`);
    if (parsed !== null) return parsed;
    // Fallback: conservative regex cleaning
    let s = text;
    s = s.replace(/<[^>]*>/g, ' ');
    // Insert spaces between letters and digits (and vice-versa) to separate
    // tokens like time400ms -> time 400ms, and also separate digits from words.
    s = s.replace(/([A-Za-z])(?=\d)/g, '$1 ').replace(/(\d)(?=[A-Za-z])/g, '$1 ');
    // Some providers concatenate token words directly to text (e.g. "speakHello").
    // Insert a space after known token prefixes when they're stuck to words.
    s = s.replace(/(speak|break|prosody|emphasis|say-as|say|voice|phoneme|sub|time|strength|rate|pitch|volume|level|alias|interpret-as|w|lex)(?=[A-Za-z0-9])/gi, '$1 ');
    // Split camelCase boundaries (e.g. "speakHello" -> "speak Hello")
    s = s.replace(/([a-z])([A-Z])/g, '$1 $2');
    // Handle token suffixes like "worldspeak" -> "world speak" so the token
    // can be removed by the subsequent garbage regex.
    s = s.replace(/(\w+)(speak|break|prosody|emphasis|say-as|say|voice|phoneme|sub|time|strength|rate|pitch|volume|level|alias|interpret-as|w|lex)\b/gi, '$1 $2');
    // Remove known token prefixes at start of the text (e.g. "speakHello" -> "Hello")
    s = s.replace(/^\s*(?:speak|break|prosody|emphasis|say-as|say|voice|phoneme|sub|time|strength|rate|pitch|volume|level|alias|interpret-as|w|lex)\s*(?=[A-Za-z0-9])/i, '');
    // Remove known token suffixes at end of the text (e.g. "worldspeak" -> "world")
    s = s.replace(/(\w+)\s*(?:speak|break|prosody|emphasis|say-as|say|voice|phoneme|sub|time|strength|rate|pitch|volume|level|alias|interpret-as|w|lex)\s*$/i, '$1');
    // Convert tokenized time markers like "time 400ms" or "time400ms" into
    // an explicit pause marker.
    s = s.replace(/\btime\s*(\d+ms)\b/gi, '[pause $1]');
    const garbage = /\b(?:speak|break|prosody|emphasis|say-as|say|voice|phoneme|sub|strength|rate|pitch|volume|level|alias|interpret-as|w|lex)\b/gi;
    s = s.replace(garbage, ' ');
    s = s.replace(/=+|[:"'<>\/\[\]\(\)\*]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  // If it looks like SRT/VTT, reconstruct with cleaned cue text only
  if (cueSplit.some(block => timestampRe.test(block))) {
    const cleanedBlocks = cueSplit.map(block => {
      const lines = block.split(/\r?\n/).map(l => l.trim());
      if (lines.length >= 2 && timestampRe.test(lines[1])) {
        // index = lines[0], time = lines[1], rest = text lines
        const index = lines[0];
        const time = lines[1];
        const text = lines.slice(2).join(' ');
        const cleaned = cleanTextLine(text);
        return [index, time, cleaned].join('\n');
      }
      // Fallback: clean the whole block
      return cleanTextLine(block);
    });
    return cleanedBlocks.join('\n\n').trim();
  }

  // Fallback for plain text: clean whole input
  return cleanTextLine(trimmed);
}

/**
 * Convert a valid SSML string to plain human-readable text. Uses the XML
 * parser to extract text nodes and turn <break time="..."/> into a
 * readable marker like "[pause 400ms]". If parsing fails, falls back to
 * the conservative regex-based cleaner.
 */
export function ssmlToPlainText(ssml: string): string {
  if (!ssml || typeof ssml !== 'string') return '';
  // Try parser extraction directly
  const parsed = (function tryExtract() {
    try {
      const v = XMLValidator.validate(ssml);
      if (v !== true) return null;
      const ast = xmlParser.parse(ssml);
      const out: string[] = [];
      function walk(nodes: any[]) {
        for (const node of nodes) {
          if (typeof node === 'string') { out.push(node); continue; }
          for (const k of Object.keys(node)) {
            if (k === '#text') { out.push(node[k]); continue; }
            const tag = k.toLowerCase();
            const val = node[k];
            if (tag === 'break') {
              let timeAttr: string | undefined;
              if (Array.isArray(val)) {
                for (const e of val) if (e && typeof e === 'object' && e[':@_time']) timeAttr = e[':@_time'];
              } else if (val && typeof val === 'object' && val[':@_time']) timeAttr = val[':@_time'];
              out.push(timeAttr ? `[pause ${timeAttr}]` : '[pause]');
              if (Array.isArray(val)) walk(val);
            } else {
              if (Array.isArray(val)) walk(val);
              else if (typeof val === 'string') out.push(val);
            }
          }
        }
      }
      walk(ast);
      let result = out.join(' ').replace(/\s+/g, ' ').trim();
      // cleanup
      result = result.replace(/\bspeak\s+/gi, '').replace(/\bbreak\b/gi, '').trim();
      return result;
    } catch {
      return null;
    }
  })();

  if (parsed !== null) return parsed;
  // Fallback to regex-based stripper
  return stripSsmlTags(ssml);
}
