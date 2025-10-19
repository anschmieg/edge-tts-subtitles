import type { WorkerVoice } from './workerClient';

const regionFormatter =
  typeof Intl !== 'undefined'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : undefined;

export function deriveVoicePresentation(
  voice: WorkerVoice,
  languageFormatter?: Intl.DisplayNames
) {
  const friendly = voice.friendlyName.replace(/^Microsoft\s+/i, '').trim();
  const [nameSegment, languageSegment] = friendly.split(' - ');
  const shortName = voice.shortName.split('-').pop() ?? voice.shortName;
  const baseShort = shortName.replace(/Multilingual/gi, '').replace(/Neural/gi, '');
  const baseName = insertSpaces(baseShort).trim();
  const isMultilingual =
    voice.isMultilingual ||
    /Multilingual/i.test(shortName) ||
    /Multilingual/i.test(friendly);
  const descriptor =
    nameSegment?.replace(/Multilingual/gi, '').replace(baseName, '').trim() ?? '';

  const [languageCode, regionCode] = voice.locale.split('-');
  const languageName =
    languageFormatter?.of(languageCode) ||
    languageSegment?.split('(')[0].trim() ||
    languageCode;
  const regionName = resolveRegionName(regionCode, languageSegment);

  return {
    baseName,
    descriptor,
    isMultilingual,
    languageName,
    regionName,
  };
}

export function formatSelectedVoiceLabel(
  voice: WorkerVoice,
  languageFormatter?: Intl.DisplayNames
) {
  const presentation = deriveVoicePresentation(voice, languageFormatter);
  const namePart = presentation.isMultilingual
    ? `${presentation.baseName} · Multilingual`
    : presentation.baseName;
  const regionPart = presentation.regionName
    ? `${presentation.languageName} (${presentation.regionName})`
    : presentation.languageName;
  return `${namePart} – ${regionPart}`;
}

export function formatListPrimaryLabel(voice: WorkerVoice) {
  const { baseName, descriptor, isMultilingual } = deriveVoicePresentation(voice);
  return {
    title: baseName,
    descriptor,
    isMultilingual,
  };
}

function insertSpaces(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function extractRegionFromSegment(segment?: string) {
  if (!segment) return '';
  const match = segment.match(/\(([^)]+)\)/);
  return match ? match[1] : '';
}

function resolveRegionName(regionCode?: string, languageSegment?: string): string {
  if (!regionCode) {
    return extractRegionFromSegment(languageSegment);
  }

  const normalized = regionCode.toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(normalized)) {
    return extractRegionFromSegment(languageSegment) || '';
  }

  try {
    return regionFormatter?.of(normalized) ?? extractRegionFromSegment(languageSegment) ?? '';
  } catch {
    return extractRegionFromSegment(languageSegment) ?? '';
  }
}
