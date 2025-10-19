import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListSubheader,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Button from '@mui/material/Button';
import RadioButtonCheckedRoundedIcon from '@mui/icons-material/RadioButtonCheckedRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { WorkerVoice, createAudioURL, generateSpeechWithSubtitles } from '../lib/workerClient';
import { formatListPrimaryLabel, formatSelectedVoiceLabel } from '../lib/voiceDisplay';

interface VoiceSelectorProps {
  voices: WorkerVoice[];
  selectedVoice: string | null;
  onVoiceChange: (voice: string) => void;
  languages: Array<{ code: string; label: string }>;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  loading?: boolean;
}

const ALL_LANGUAGES_VALUE = 'all';

export function VoiceSelector({
  voices,
  selectedVoice,
  onVoiceChange,
  languages,
  selectedLanguage,
  onLanguageChange,
  loading = false,
}: VoiceSelectorProps) {
  const [query, setQuery] = useState('');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const languageFormatter = useMemo(() => {
    try {
      return new Intl.DisplayNames(['en'], { type: 'language' });
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioElement, audioUrl]);

  useEffect(() => {
    if (playingVoice && !voices.some((v) => v.shortName === playingVoice)) {
      stopPlayback();
    }
  }, [voices, playingVoice]);

  const filteredVoices = useMemo(() => {
    let list = voices;
    if (selectedLanguage !== ALL_LANGUAGES_VALUE) {
      list = list.filter((voice) => voice.language === selectedLanguage);
    }
    if (query.trim()) {
      const normalized = query.trim().toLowerCase();
      list = list.filter((voice) => {
        return (
          voice.friendlyName.toLowerCase().includes(normalized) ||
          voice.shortName.toLowerCase().includes(normalized) ||
          voice.locale.toLowerCase().includes(normalized)
        );
      });
    }
    return list;
  }, [voices, selectedLanguage, query]);

  const groupedVoices = useMemo(() => {
    const groups = new Map<string, WorkerVoice[]>();
    filteredVoices.forEach((voice) => {
      if (!groups.has(voice.locale)) {
        groups.set(voice.locale, []);
      }
      groups.get(voice.locale)!.push(voice);
    });

    return Array.from(groups.entries())
      .map(([locale, entries]) => {
        const languageCode = locale.split('-')[0];
        const label =
          languages.find((lang) => lang.code === languageCode)?.label ||
          languageFormatter?.of(languageCode) ||
          languageCode;
        return {
          locale,
          label,
          entries: entries.sort((a, b) => a.friendlyName.localeCompare(b.friendlyName)),
        };
      })
      .sort((a, b) => a.locale.localeCompare(b.locale));
  }, [filteredVoices, languages, languageFormatter]);

  const selectedVoiceMeta = useMemo(
    () => voices.find((voice) => voice.shortName === selectedVoice) || null,
    [voices, selectedVoice]
  );

  const stopPlayback = () => {
    if (audioElement) {
      audioElement.pause();
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioElement(null);
    setAudioUrl(null);
    setPlayingVoice(null);
  };

  const handlePreview = async (voice: WorkerVoice) => {
    if (playingVoice === voice.shortName) {
      stopPlayback();
      return;
    }

    stopPlayback();
    setPlayingVoice(voice.shortName);

    try {
      const languageDisplay =
        languages.find((lang) => lang.code === voice.language)?.label ||
        languageFormatter?.of(voice.language) ||
        voice.language;
      const demoText = `Hello! I am ${formatListPrimaryLabel(voice).title}. I speak ${languageDisplay} with confidence.`;

      const response = await generateSpeechWithSubtitles(
        {
          input: demoText,
          voice: voice.shortName,
        },
        false
      );

      const url = createAudioURL(response.audio_content_base64);
      const audio = new Audio(url);

      audio.onended = stopPlayback;
      audio.onerror = stopPlayback;

      setAudioElement(audio);
      setAudioUrl(url);
      await audio.play();
    } catch (error) {
      console.error('Error playing demo:', error);
      stopPlayback();
      alert('Failed to play demo. Make sure the worker is reachable.');
    }
  };

  return (
    <Stack spacing={2.25}>
      {selectedVoiceMeta && (
        <SelectedVoiceCard
          voice={selectedVoiceMeta}
          playing={playingVoice === selectedVoiceMeta.shortName}
          onPreview={handlePreview}
          languageFormatter={languageFormatter ?? undefined}
        />
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <TextField
          label="Search voices"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or locale"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1 }}
        />

        <TextField
          select
          label="Language"
          value={selectedLanguage}
          onChange={(event) => onLanguageChange(event.target.value)}
          sx={{ flex: 1, minWidth: { sm: 180 } }}
        >
          {languages.map((lang) => (
            <MenuItem key={lang.code} value={lang.code}>
              {lang.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {loading && !voices.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : groupedVoices.length === 0 ? (
        <Box
          sx={{
            borderRadius: 2,
            border: '1px dashed rgba(140,130,255,0.35)',
            p: 3,
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            No voices match the current filters.
          </Typography>
        </Box>
      ) : (
        <List
          dense
          sx={{
            width: '100%',
            bgcolor: 'transparent',
            borderRadius: 2,
            border: '1px solid rgba(140,130,255,0.12)',
            maxHeight: 360,
            overflowY: 'auto',
            '& ul': { padding: 0, margin: 0 },
          }}
          subheader={<li />}
        >
          {groupedVoices.map((group) => (
            <li key={group.locale}>
              <ul>
                <ListSubheader
                  component="div"
                  disableSticky
                  sx={{ bgcolor: 'rgba(255,255,255,0.02)', color: 'text.secondary' }}
                >
                  {group.label}
                </ListSubheader>
                {group.entries.map((voice) => {
                  const isSelected = voice.shortName === selectedVoice;
                  const isPlaying = voice.shortName === playingVoice;
                  const presentation = formatListPrimaryLabel(voice);

                  return (
                    <ListItem
                      key={voice.shortName}
                      disablePadding
                    secondaryAction={
                      <Tooltip title={isPlaying ? 'Stop preview' : 'Play sample'} arrow>
                        <Button
                          variant="contained"
                          color={isPlaying ? 'primary' : 'secondary'}
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            handlePreview(voice);
                          }}
                          startIcon={isPlaying ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
                          sx={{ borderRadius: 999, px: 2 }}
                        >
                          {isPlaying ? 'Stop' : 'Play'}
                        </Button>
                      </Tooltip>
                    }
                    >
                      <ListItemButton
                        onClick={() => onVoiceChange(voice.shortName)}
                        selected={isSelected}
                        sx={{
                          borderRadius: isSelected ? 2 : 0,
                          '&.Mui-selected': {
                            backgroundColor: 'rgba(140,130,255,0.15)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          {isSelected ? (
                            <RadioButtonCheckedRoundedIcon color="primary" fontSize="small" />
                          ) : (
                            <RadioButtonUncheckedRoundedIcon fontSize="small" sx={{ opacity: 0.6 }} />
                          )}

                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {presentation.title}
                                </Typography>
                                {presentation.isMultilingual && (
                                  <Chip label="Multilingual" size="small" color="primary" variant="outlined" />
                                )}
                              </Stack>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {presentation.descriptor || voice.shortName}
                              </Typography>
                            }
                          />
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </ul>
            </li>
          ))}
        </List>
      )}

      {selectedVoiceMeta && (
        <Box sx={{ borderRadius: 2, border: '1px solid rgba(140,130,255,0.12)', p: 2 }}>
          <Typography variant="subtitle2">
            {formatSelectedVoiceLabel(selectedVoiceMeta, languageFormatter ?? undefined)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Voice ID: {selectedVoiceMeta.shortName}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

function SelectedVoiceCard({
  voice,
  playing,
  onPreview,
  languageFormatter,
}: {
  voice: WorkerVoice;
  playing: boolean;
  onPreview: (voice: WorkerVoice) => void;
  languageFormatter?: Intl.DisplayNames;
}) {
  const presentation = formatListPrimaryLabel(voice);
  const label = formatSelectedVoiceLabel(voice, languageFormatter);

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid rgba(255,180,120,0.35)',
        background: 'linear-gradient(135deg, rgba(255,213,153,0.18), rgba(255,180,120,0.1))',
        p: 2,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
        <Stack spacing={0.75} flex={1}>
          <Typography variant="subtitle1">{label}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label="Selected" size="small" color="warning" />
            {presentation.isMultilingual && (
              <Chip label="Multilingual" size="small" color="warning" variant="outlined" />
            )}
          </Stack>
          {presentation.descriptor && (
            <Typography variant="caption" color="text.secondary">
              {presentation.descriptor}
            </Typography>
          )}
        </Stack>
        <Tooltip title={playing ? 'Stop preview' : 'Play preview'} arrow>
          <Button
            variant="contained"
            color="warning"
            onClick={() => onPreview(voice)}
            startIcon={playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
            size="small"
            sx={{ borderRadius: 999, px: 2.5 }}
          >
            {playing ? 'Stop preview' : 'Play preview'}
          </Button>
        </Tooltip>
      </Stack>
    </Box>
  );
}
