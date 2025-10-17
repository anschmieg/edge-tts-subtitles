import parser from 'srt-parser-2';
import { extractTextFromSsml } from './ssml';

export interface SubtitleCue {
  id: string;
  startTime: number; // milliseconds
  endTime: number; // milliseconds
  text: string;
}

/**
 * Parse SRT format subtitle content
 */
export function parseSRT(content: string): SubtitleCue[] {
  const srtParser = new parser();
  const parsed = srtParser.fromSrt(content);

  return parsed.map((cue: any) => ({
    id: cue.id,
    startTime: srtTimeToMs(cue.startTime),
    endTime: srtTimeToMs(cue.endTime),
    // If the worker returned SSML inside subtitle text, extract readable text
    text: extractTextFromSsml(cue.text || ''),
  }));
}

/**
 * Parse VTT format subtitle content
 */
export function parseVTT(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = content.split('\n');

  let currentCue: Partial<SubtitleCue> = {};
  let cueId = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip WEBVTT header and empty lines
    if (!line || line.startsWith('WEBVTT')) continue;

    // Check if line is a timestamp
    if (line.includes('-->')) {
      const [start, end] = line.split('-->').map(s => s.trim());
      currentCue.id = String(cueId++);
      currentCue.startTime = vttTimeToMs(start);
      currentCue.endTime = vttTimeToMs(end);
    } else if (currentCue.startTime !== undefined) {
      // This is the text content. Strip SSML if present so we display plain text.
      currentCue.text = extractTextFromSsml(line || '');
      cues.push(currentCue as SubtitleCue);
      currentCue = {};
    }
  }

  return cues;
}

/**
 * Convert SRT timestamp (HH:MM:SS,mmm) to milliseconds
 */
function srtTimeToMs(timeString: string): number {
  return vttTimeToMs(timeString.replace(',', '.'));
}

/**
 * Convert VTT timestamp to milliseconds
 */
function vttTimeToMs(timeString: string): number {
  const parts = timeString.split(':');
  const seconds = parts[parts.length - 1].split('.');

  let ms = 0;
  if (parts.length === 3) {
    // HH:MM:SS.mmm
    ms += parseInt(parts[0]) * 3600000; // hours
    ms += parseInt(parts[1]) * 60000;   // minutes
  } else {
    // MM:SS.mmm
    ms += parseInt(parts[0]) * 60000;   // minutes
  }

  ms += parseInt(seconds[0]) * 1000;    // seconds
  if (seconds[1]) {
    ms += parseInt(seconds[1]);          // milliseconds
  }

  return ms;
}

/**
 * Parse subtitle content based on format
 */
export function parseSubtitles(content: string, format: 'srt' | 'vtt'): SubtitleCue[] {
  if (format === 'vtt') {
    return parseVTT(content);
  }
  return parseSRT(content);
}

/**
 * Find the active cue at a given time
 */
export function findActiveCue(cues: SubtitleCue[], currentTime: number): SubtitleCue | null {
  const timeMs = currentTime * 1000; // convert to milliseconds
  return cues.find(cue => timeMs >= cue.startTime && timeMs <= cue.endTime) || null;
}

/**
 * Split text into words for per-word highlighting
 * 
 * TODO: Implement per-word timing when worker provides word-level timestamps.
 * Current implementation approximates word timings by dividing cue duration evenly.
 */
export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
}

export function approximateWordTimings(cue: SubtitleCue): WordTiming[] {
  const words = cue.text.split(/\s+/).filter(w => w.length > 0);
  const duration = cue.endTime - cue.startTime;
  const timePerWord = duration / words.length;

  return words.map((word, index) => ({
    word,
    startTime: cue.startTime + (index * timePerWord),
    endTime: cue.startTime + ((index + 1) * timePerWord),
  }));
}

/**
 * Find active word in a cue (approximate)
 */
export function findActiveWord(
  cue: SubtitleCue,
  currentTime: number
): { word: string; index: number } | null {
  const timeMs = currentTime * 1000;
  const wordTimings = approximateWordTimings(cue);

  const activeIndex = wordTimings.findIndex(
    wt => timeMs >= wt.startTime && timeMs <= wt.endTime
  );

  if (activeIndex === -1) return null;

  return {
    word: wordTimings[activeIndex].word,
    index: activeIndex,
  };
}
