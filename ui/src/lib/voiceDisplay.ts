import type { WorkerVoice } from './workerClient';

const regionFormatter =
  typeof Intl !== 'undefined'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : undefined;

export function deriveVoicePresentation(
  voice: WorkerVoice,
  languageFormatter?: Intl.DisplayNames
) {
  const baseName = voice.name;
  const isMultilingual = voice.isMultilingual;
  const descriptor = ''; // No longer needed since name is already clean

  const languageName = languageFormatter?.of(voice.language) || voice.language;
  const regionName = resolveRegionName(voice.region);

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


function resolveRegionName(regionCode?: string): string {
  if (!regionCode) {
    return '';
  }

  const normalized = regionCode.toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(normalized)) {
    return '';
  }

  try {
    return regionFormatter?.of(normalized) ?? '';
  } catch {
    return '';
  }
}
