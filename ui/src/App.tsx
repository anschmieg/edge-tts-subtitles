import { useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import { VoiceSelector } from './components/VoiceSelector';
import { ProsodyControls } from './components/ProsodyControls';
import { LLMPreprocessing } from './components/LLMPreprocessing';
import { ResultPanel } from './components/ResultPanel';
import {
  fetchVoices,
  generateSpeechWithSubtitles,
  type TTSRequest,
  type WorkerVoice,
} from './lib/workerClient';
import { formatSelectedVoiceLabel } from './lib/voiceDisplay';

const DEFAULT_VOICE_ID = 'en-US-EmmaMultilingualNeural';
const DEFAULT_RATE = 100;
const DEFAULT_PITCH_STEPS = 0;
const DEFAULT_VOLUME = 0;

type TabValue = 'script' | 'voice' | 'delivery' | 'enhance' | 'result';
type PitchUnit = 'percent' | 'hz' | 'semitone';

interface TabPanelProps {
  current: TabValue;
  value: TabValue;
  children: React.ReactNode;
}

function TabPanel({ current, value, children }: TabPanelProps) {
  return (
    <Box
      role="tabpanel"
      hidden={current !== value}
      id={`tts-tabpanel-${value}`}
      aria-labelledby={`tts-tab-${value}`}
      sx={{ py: current === value ? 3 : 0 }}
    >
      {current === value && <Box>{children}</Box>}
    </Box>
  );
}

function tabA11yProps(value: TabValue) {
  return {
    id: `tts-tab-${value}`,
    'aria-controls': `tts-tabpanel-${value}`,
  };
}

function getLanguageLabel(displayNames: Intl.DisplayNames | null, code: string): string {
  if (code === 'all') return 'All languages';
  if (!code) return 'Unknown';
  return displayNames?.of(code) ?? code;
}

function App() {
  const theme = useTheme();
  const isWideTabs = useMediaQuery(theme.breakpoints.up('md'));
  const [text, setText] = useState(
    'Hello, world! This is a test of the Edge TTS Subtitles service.'
  );
  const [voices, setVoices] = useState<WorkerVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState<string>('');
  const [voicesFetched, setVoicesFetched] = useState(false);
  const [voice, setVoice] = useState<string | null>(DEFAULT_VOICE_ID);
  const [voiceManuallySet, setVoiceManuallySet] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [subtitleFormat, setSubtitleFormat] = useState<'srt' | 'vtt'>('srt');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [rate, setRate] = useState<number>(DEFAULT_RATE);
  const [pitchSteps, setPitchSteps] = useState<number>(DEFAULT_PITCH_STEPS);
  const [pitchUnit, setPitchUnit] = useState<PitchUnit>('semitone');
  const [volume, setVolume] = useState<number>(DEFAULT_VOLUME);
  const [llmEndpoint, setLLMEndpoint] = useState(
    'https://api.openai.com/v1/chat/completions'
  );
  const [llmApiKey, setLLMApiKey] = useState('');
  const [optimizeForTTS, setOptimizeForTTS] = useState(false);
  const [addSSML, setAddSSML] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [result, setResult] = useState<{
    audioBase64: string;
    subtitleContent: string;
    subtitleFormat: 'srt' | 'vtt';
    voice: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabValue>('script');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const snapDisableTimeout = useRef<number | null>(null);
  const enhancementsActive = optimizeForTTS || addSSML;

  const languageFormatter = useMemo(() => {
    try {
      return new Intl.DisplayNames(['en'], { type: 'language' });
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'voice' || voicesFetched || voicesLoading) {
      return;
    }

    let cancelled = false;
    setVoicesLoading(true);
    setVoicesError('');
    fetchVoices()
      .then((data) => {
        if (cancelled) return;
        setVoices(data);
        setVoicesFetched(true);
        if (!voiceManuallySet && data.length && !voice) {
          setVoice(data[0].shortName);
        }
      })
      .catch((err) => {
        console.error('Failed to load voices', err);
        if (cancelled) return;
        setVoicesError(err instanceof Error ? err.message : 'Failed to load voice list');
      })
      .finally(() => {
        if (!cancelled) {
          setVoicesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, voicesFetched, voicesLoading, voiceManuallySet, voice]);

  useEffect(() => {
    if (voiceManuallySet) return;
    if (!voices.length) return;
    const defaultVoice =
      voices.find((candidate) => candidate.isMultilingual) ?? voices[0];
    if (defaultVoice && voice !== defaultVoice.shortName) {
      setVoice(defaultVoice.shortName);
    }
  }, [voices, voice, voiceManuallySet]);

  useEffect(() => {
    if (result) {
      setActiveTab('result');
    }
  }, [result]);

  useEffect(() => {
    if (!result && activeTab === 'result') {
      setActiveTab('script');
    }
  }, [result, activeTab]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const cards = Array.from(
      container.querySelectorAll<HTMLElement>(':scope > .snap-card')
    );
    if (!cards.length) {
      return;
    }

    cards.forEach((card) => card.classList.remove('snap-card-active'));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('snap-card-active', entry.isIntersecting);
        });
      },
      { root: container, threshold: 0.7 }
    );

    cards.forEach((card) => observer.observe(card));
    if (cards[0]) {
      cards[0].classList.add('snap-card-active');
    }

    return () => {
      cards.forEach((card) => observer.unobserve(card));
      observer.disconnect();
    };
  }, [result, activeTab, subtitlesEnabled, subtitleFormat]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollables = Array.from(
      container.querySelectorAll<HTMLElement>('.snap-card-scroll')
    );
    const wheelHandlers: Array<{ el: HTMLElement; handler: (event: WheelEvent) => void }> = [];
    const touchHandlers: Array<{ el: HTMLElement; start: (event: TouchEvent) => void; move: (event: TouchEvent) => void }> = [];
    const touchStartMap = new WeakMap<HTMLElement, number>();

    const disableSnapTemporarily = () => {
      if (!container) return;
      container.dataset.snapDisabled = 'true';
      if (snapDisableTimeout.current !== null) {
        window.clearTimeout(snapDisableTimeout.current);
      }
      snapDisableTimeout.current = window.setTimeout(() => {
        if (container) {
          delete container.dataset.snapDisabled;
        }
        snapDisableTimeout.current = null;
      }, 220);
    };

    scrollables.forEach((el) => {
      const onWheel = (event: WheelEvent) => {
        if (el.scrollHeight <= el.clientHeight) return;
        const deltaY = event.deltaY;
        const atTop = el.scrollTop <= 0;
        const atBottom = Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 1;
        if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) {
          event.stopPropagation();
          disableSnapTemporarily();
        }
      };
      const onTouchStart = (event: TouchEvent) => {
        if (event.touches.length === 1) {
          touchStartMap.set(el, event.touches[0].clientY);
        }
      };
      const onTouchMove = (event: TouchEvent) => {
        if (el.scrollHeight <= el.clientHeight) return;
        const startY = touchStartMap.get(el);
        if (startY == null) return;
        const currentY = event.touches[0].clientY;
        const deltaY = startY - currentY;
        const atTop = el.scrollTop <= 0;
        const atBottom = Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 1;
        if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) {
          event.stopPropagation();
          disableSnapTemporarily();
        }
      };

      el.addEventListener('wheel', onWheel, { passive: true });
      el.addEventListener('touchstart', onTouchStart, { passive: true });
      el.addEventListener('touchmove', onTouchMove, { passive: true });
      wheelHandlers.push({ el, handler: onWheel });
      touchHandlers.push({ el, start: onTouchStart, move: onTouchMove });
    });

    return () => {
      wheelHandlers.forEach(({ el, handler }) => el.removeEventListener('wheel', handler));
      touchHandlers.forEach(({ el, start, move }) => {
        el.removeEventListener('touchstart', start);
        el.removeEventListener('touchmove', move);
      });
      if (snapDisableTimeout.current !== null) {
        window.clearTimeout(snapDisableTimeout.current);
        snapDisableTimeout.current = null;
      }
      delete container.dataset.snapDisabled;
    };
  }, [activeTab, result, subtitlesEnabled, subtitleFormat, optimizeForTTS, addSSML]);

  const selectedVoiceMeta = useMemo(
    () => voices.find((candidate) => candidate.shortName === voice) ?? null,
    [voices, voice]
  );

  const languages = useMemo(() => {
    const map = new Map<string, string>();
    map.set('all', 'All languages');
    voices.forEach((v) => {
      if (!map.has(v.language)) {
        map.set(v.language, getLanguageLabel(languageFormatter, v.language));
      }
    });
    return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
  }, [voices, languageFormatter]);

  const tabItems: { value: TabValue; label: string }[] = [
    { value: 'script', label: 'Script' },
    { value: 'voice', label: 'Voice' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'enhance', label: 'Enhance' },
  ];
  if (result) {
    tabItems.push({ value: 'result', label: 'Playback' });
  }

  const isProsodyDefault =
    rate === DEFAULT_RATE && pitchSteps === DEFAULT_PITCH_STEPS && volume === DEFAULT_VOLUME;

  const handleVoiceChange = (voiceId: string) => {
    setVoice(voiceId);
    setVoiceManuallySet(true);
  };

  const handleLanguageChange = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    setVoiceManuallySet(true);
    const pool =
      languageCode === 'all'
        ? voices
        : voices.filter((voiceItem) => voiceItem.language === languageCode);
    if (!pool.length) {
      return;
    }
    if (!voice || !pool.some((voiceItem) => voiceItem.shortName === voice)) {
      const fallback =
        pool.find((voiceItem) => voiceItem.isMultilingual) ?? pool[0];
      setVoice(fallback.shortName);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!voice) {
      setError('Select a voice before generating speech.');
      return;
    }
    if (!text.trim()) {
      setError('Enter text to synthesize.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      let processedText = text;
      let useRawSSML = false;

      if (enhancementsActive) {
        if (!llmEndpoint || !llmApiKey) {
          throw new Error(
            'LLM endpoint and API key are required when preprocessing is enabled.'
          );
        }

        const config = {
          endpoint: llmEndpoint,
          apiKey: llmApiKey,
        };

        if (optimizeForTTS) {
          const { optimizeTextForTTS } = await import('./lib/llmClient');
          processedText = await optimizeTextForTTS(config, processedText);
        }

        if (addSSML) {
          const { addSSMLMarkup } = await import('./lib/llmClient');
          processedText = await addSSMLMarkup(config, processedText);
          useRawSSML = true;
        }
      }

      const request: TTSRequest = {
        input: processedText,
        voice,
      };

      if (subtitlesEnabled) {
        request.subtitle_format = subtitleFormat;
      }

      if (useRawSSML) {
        request.raw_ssml = processedText;
        request.input = text;
      } else {
        request.input = processedText;
        if (rate !== DEFAULT_RATE) {
          request.rate = `${rate}%`;
        }
        if (pitchSteps !== DEFAULT_PITCH_STEPS) {
          const formatted =
            (pitchSteps >= 0 ? '+' : '') + pitchSteps.toFixed(2) + 'st';
          request.pitch = formatted;
        }
        if (volume !== DEFAULT_VOLUME) {
          request.volume = `${volume}%`;
        }
      }

      const response = await generateSpeechWithSubtitles(request, mockMode);

      setResult({
        audioBase64: response.audio_content_base64,
        subtitleContent: subtitlesEnabled ? response.subtitle_content : '',
        subtitleFormat: response.subtitle_format,
        voice,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const subtitleSummary = subtitlesEnabled
    ? `Subtitles: ${subtitleFormat.toUpperCase()}`
    : 'Subtitles off';
  const pitchSummaryValue = formatPitchSummary(pitchSteps, pitchUnit);
  const rateSummary = `${rate}%`;
  const volumeSummary = volume === 0 ? '0%' : `${volume > 0 ? '+' : ''}${volume}%`;
  const llmRequiresConfig =
    enhancementsActive && (!llmEndpoint.trim() || !llmApiKey.trim());
  const isGenerateDisabled =
    loading || !voice || !text.trim() || llmRequiresConfig;

  const handleTabChange = (_event: SyntheticEvent, value: TabValue) => {
    setActiveTab(value);
  };

  const handleTabSelect = (event: SelectChangeEvent<TabValue>) => {
    setActiveTab(event.target.value as TabValue);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: 'divider', backdropFilter: 'blur(12px)', flexShrink: 0 }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', gap: 2, py: 2 }}>
          <Stack spacing={0.5}>
            <Typography variant="h6" sx={{ letterSpacing: '-0.02em' }}>
              Edge TTS Studio
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Generate natural speech with synced subtitles in a few guided steps.
            </Typography>
          </Stack>
          <Button
            variant="outlined"
            color="primary"
            endIcon={<LaunchRoundedIcon />}
            href="https://github.com/anschmieg/edge-tts-subtitles/tree/main/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Docs
          </Button>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: 0,
          py: { xs: 3, md: 4 },
          px: { xs: 1.5, md: 3 },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            px: { xs: 0, md: 1 },
            overflow: 'hidden',
          }}
        >
          <Stack
            data-testid="snap-stack"
            ref={scrollContainerRef}
            spacing={{ xs: 3, md: 4 }}
            sx={{
              flex: 1,
              minHeight: 0,
              maxHeight: '100%',
              overflowY: 'scroll',
              overscrollBehaviorY: 'contain',
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth',
              scrollSnapType: 'y mandatory',
              scrollSnapStop: 'always',
              scrollPaddingTop: (theme) => theme.spacing(3),
              pb: 4,
              pr: { xs: 1, md: 2 },
              pl: { xs: 1, md: 2 },
               scrollbarWidth: 'none',
               '&::-webkit-scrollbar': { display: 'none' },
              '& > *': {
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                flexShrink: 0,
              },
            }}
          >
            <Card
              className="snap-card"
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 4,
                background: 'linear-gradient(125deg, rgba(140,130,255,0.85), rgba(46,230,197,0.35))',
                border: '1px solid rgba(140,130,255,0.35)',
                color: 'primary.contrastText',
                px: { xs: 3, md: 6 },
                py: { xs: 4, md: 6 },
                minHeight: { xs: '80vh', md: '72vh' },
                width: { xs: '100%', md: 'min(100%, 960px)' },
                mx: 'auto',
              }}
            >
              <CardContent sx={{ px: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                <Stack spacing={3}>
                  <Chip
                    icon={<AutoAwesomeRoundedIcon />}
                    label="Progressive web experience"
                    variant="outlined"
                    sx={{
                      alignSelf: { xs: 'flex-start', md: 'center' },
                      color: 'primary.contrastText',
                      borderColor: 'primary.contrastText',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      fontSize: 13,
                      '& .MuiChip-icon': { color: 'primary.contrastText' },
                    }}
                  />
                  <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
                    Craft speech, tune delivery, publish instantly.
                  </Typography>
                  <Typography variant="h6" sx={{ opacity: 0.85, fontWeight: 400 }}>
                    Start with plain text, then step into voice, parameters, and enhancements only
                    when you need them. Your player appears as soon as audio renders.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            <Card
              className="snap-card"
              component="form"
              onSubmit={handleSubmit}
              sx={{
                borderRadius: 3,
                minHeight: { xs: '80vh', md: '72vh' },
                width: { xs: '100%', md: 'min(100%, 960px)' },
                mx: 'auto',
              }}
            >
              <CardContent
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 0,
                  px: { xs: 2.5, md: 4 },
                  py: { xs: 3, md: 4 },
                }}
              >
                <Box
                  className="snap-card-scroll"
                  sx={{
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    pr: { xs: 1, md: 2 },
                    pb: 4,
                    mr: { xs: -1, md: -2 },
                  }}
                >
                  <Stack spacing={3}>
                    <Stack spacing={1}>
                      <Typography variant="overline" color="primary">
                        Snapshot
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                        <Chip
                          label={
                            selectedVoiceMeta
                              ? formatSelectedVoiceLabel(selectedVoiceMeta, languageFormatter ?? undefined)
                              : voicesLoading
                              ? 'Loading voices…'
                              : voicesError
                              ? 'Voice list unavailable'
                              : 'Select a voice'
                          }
                          variant="outlined"
                          color={selectedVoiceMeta ? 'primary' : 'default'}
                        />
                        <Chip label={subtitleSummary} variant="outlined" />
                        <Chip
                          label={
                            isProsodyDefault
                              ? 'Delivery: default'
                              : `Delivery tweaked (${rateSummary}, ${pitchSummaryValue}, ${volumeSummary})`
                          }
                          variant="outlined"
                        />
                        {enhancementsActive && (
                          <Chip label="LLM enhancements" color="secondary" variant="outlined" />
                        )}
                      </Stack>
                    </Stack>

                    {isWideTabs ? (
                      <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        variant="fullWidth"
                        textColor="primary"
                        indicatorColor="primary"
                        TabIndicatorProps={{
                          sx: {
                            height: 2,
                            borderRadius: 999,
                            bottom: 6,
                            left: 16,
                            right: 16,
                            backgroundColor: theme.palette.primary.main,
                            opacity: 0.7,
                          },
                        }}
                        sx={{
                          borderRadius: 2,
                          backgroundColor: 'rgba(140,130,255,0.08)',
                          '& .MuiTab-root': {
                            color: 'text.secondary',
                            fontWeight: 600,
                            borderRadius: 1.5,
                            minHeight: 48,
                          },
                          '& .Mui-selected': {
                            color: 'primary.main',
                            backgroundColor: 'rgba(140,130,255,0.18)',
                          },
                        }}
                      >
                        {tabItems.map((tab) => (
                          <Tab
                            key={tab.value}
                            value={tab.value}
                            label={tab.label}
                            {...tabA11yProps(tab.value)}
                          />
                        ))}
                      </Tabs>
                    ) : (
                      <FormControl fullWidth size="small">
                        <InputLabel id="section-select-label">Section</InputLabel>
                        <Select
                          labelId="section-select-label"
                          value={activeTab}
                          label="Section"
                          onChange={handleTabSelect}
                        >
                          {tabItems.map((tab) => (
                            <MenuItem key={tab.value} value={tab.value}>
                              {tab.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}

                    <Divider />

                    <TabPanel current={activeTab} value="script">
                      <Stack spacing={2}>
                        <Stack spacing={0.75}>
                          <Typography variant="overline" color="primary">
                            Step 1
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Craft your script
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Provide the narration you want to hear. You can add multiple paragraphs or paste a full script.
                          </Typography>
                        </Stack>
                        <TextField
                          multiline
                          minRows={5}
                          label="Script"
                          value={text}
                          onChange={(event) => setText(event.target.value)}
                          placeholder="Type or paste the lines you want spoken."
                        />
                        <Typography variant="caption" color="text.secondary">
                          Tip: keep sentences short and clear for the most natural speech.
                        </Typography>
                      </Stack>
                    </TabPanel>

                    <TabPanel current={activeTab} value="voice">
                      <Stack spacing={2.5}>
                        <Stack spacing={0.75}>
                          <Typography variant="overline" color="primary">
                            Step 2
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Choose a voice and language
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Filter by language, audition samples, and pick the voice that matches your project.
                          </Typography>
                        </Stack>
                        <VoiceSelector
                          voices={voices}
                          selectedVoice={voice}
                          onVoiceChange={handleVoiceChange}
                          languages={languages}
                          selectedLanguage={selectedLanguage}
                          onLanguageChange={handleLanguageChange}
                          loading={voicesLoading}
                        />
                        {voicesError && (
                          <Alert severity="error" onClose={() => setVoicesError('')}>
                            {voicesError}
                          </Alert>
                        )}
                      </Stack>
                    </TabPanel>

                    <TabPanel current={activeTab} value="delivery">
                      <Stack spacing={3}>
                        <Stack spacing={0.75}>
                          <Typography variant="overline" color="primary">
                            Step 3
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Shape the delivery and subtitles
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Adjust pace, pitch, and loudness. Decide whether to export timed subtitles.
                          </Typography>
                        </Stack>
                        <ProsodyControls
                          rate={rate}
                          pitchSteps={pitchSteps}
                          pitchUnit={pitchUnit}
                          volume={volume}
                          onRateChange={setRate}
                          onPitchValueChange={setPitchSteps}
                          onPitchUnitChange={setPitchUnit}
                          onVolumeChange={setVolume}
                        />

                        <Stack spacing={1.5}>
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                            justifyContent="space-between"
                          >
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              Subtitle export
                            </Typography>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={subtitlesEnabled}
                                  onChange={(event) => setSubtitlesEnabled(event.target.checked)}
                                  color="primary"
                                />
                              }
                              label="Include subtitles"
                              sx={{ m: 0, '& .MuiFormControlLabel-label': { color: 'text.secondary' } }}
                            />
                          </Stack>
                          <Collapse in={subtitlesEnabled}>
                            <Stack spacing={1.5}>
                              <Typography variant="body2" color="text.secondary">
                                Toggle between SubRip and WebVTT formats.
                              </Typography>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={subtitleFormat === 'vtt'}
                                    onChange={(event) =>
                                      setSubtitleFormat(event.target.checked ? 'vtt' : 'srt')
                                    }
                                    color="primary"
                                  />
                                }
                                label={
                                  subtitleFormat === 'vtt'
                                    ? 'WebVTT (.vtt)'
                                    : 'SubRip (.srt)'
                                }
                                sx={{ m: 0, '& .MuiFormControlLabel-label': { color: 'text.secondary' } }}
                              />
                            </Stack>
                          </Collapse>
                        </Stack>
                      </Stack>
                    </TabPanel>

                    <TabPanel current={activeTab} value="enhance">
                      <Stack spacing={2.5}>
                        <Stack spacing={0.75}>
                          <Typography variant="overline" color="primary">
                            Step 4
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Enhance with AI (optional)
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Connect an LLM to polish your script or add SSML annotations directly in the browser.
                          </Typography>
                        </Stack>

                        <EnhancementCard>
                          <LLMPreprocessing
                            llmEndpoint={llmEndpoint}
                            onLLMEndpointChange={setLLMEndpoint}
                            llmApiKey={llmApiKey}
                            onLLMApiKeyChange={setLLMApiKey}
                            requireCredentials={enhancementsActive}
                          />
                        </EnhancementCard>

                        <EnhancementOptionCard
                          title="Optimize text for better reading flow"
                          description="Cleans numbers, abbreviations, and symbols so speech reads naturally while staying true to the original content."
                          checked={optimizeForTTS}
                          onToggle={setOptimizeForTTS}
                        />

                        <EnhancementOptionCard
                          title="Fine-tune pronunciation using AI"
                          subtitle="Adds SSML markup"
                          description="Adds SSML markup for pauses, emphasis, and pronunciation control."
                          checked={addSSML}
                          onToggle={setAddSSML}
                        />
                      </Stack>
                    </TabPanel>

                    {result && (
                      <TabPanel current={activeTab} value="result">
                        <Stack spacing={1.5}>
                          <Typography variant="overline" color="primary">
                            Step 5
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Review & download
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Scroll to the Output card below to play your audio, review subtitles, and download files.
                          </Typography>
                        </Stack>
                      </TabPanel>
                    )}

                    <Divider />

                    <Stack spacing={1.5}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        justifyContent="space-between"
                      >
                        <Stack spacing={0.25}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Final step
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Enable mock mode for demo output without calling the worker.
                          </Typography>
                        </Stack>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={mockMode}
                              onChange={(event) => setMockMode(event.target.checked)}
                              color="primary"
                            />
                          }
                          label="Mock mode"
                          sx={{ m: 0, '& .MuiFormControlLabel-label': { color: 'text.secondary' } }}
                        />
                      </Stack>
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={isGenerateDisabled}
                        startIcon={
                          loading ? <CircularProgress size={18} color="inherit" /> : undefined
                        }
                        sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, minWidth: 200 }}
                      >
                        {loading ? 'Generating…' : 'Generate speech'}
                      </Button>
                      <Collapse in={Boolean(error)}>
                        <Alert severity="error" onClose={() => setError('')}>
                          {error}
                        </Alert>
                      </Collapse>
                    </Stack>
                  </Stack>
                </Box>
              </CardContent>
            </Card>

            {result ? (
              <ResultPanel
                audioBase64={result.audioBase64}
                subtitleContent={result.subtitleContent}
                subtitleFormat={result.subtitleFormat}
                voice={result.voice}
                showSubtitles={subtitlesEnabled}
              />
            ) : (
              <Card
                className="snap-card"
                sx={{
                  borderRadius: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: { xs: '80vh', md: '72vh' },
                  width: { xs: '100%', md: 'min(100%, 960px)' },
                  mx: 'auto',
                  textAlign: 'center',
                }}
              >
                <CardContent
                  className="snap-card-scroll"
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    px: { xs: 3, md: 4 },
                    py: { xs: 4, md: 5 },
                  }}
                >
                  <Stack spacing={2} alignItems="center">
                    <Typography variant="h6">Your rendered audio will appear here.</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
                      Step through the tabs: enter text, audition voices, tweak delivery, optionally
                      enhance with LLM, then generate to unlock the playback tab.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}

export default App;

function formatPitchSummary(steps: number, unit: PitchUnit): string {
  if (steps === 0) {
    return unit === 'semitone' ? '0 st' : `0${unit === 'hz' ? 'Hz' : '%'}`;
  }
  switch (unit) {
    case 'percent': {
      const percent = Math.round((steps / 12) * 100);
      return `${percent > 0 ? '+' : ''}${percent}%`;
    }
    case 'hz': {
      const hz = Math.round(steps * 100);
      return `${hz > 0 ? '+' : ''}${hz}Hz`;
    }
    case 'semitone':
    default:
      return `${steps > 0 ? '+' : ''}${steps}st`;
  }
}

function EnhancementCard({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: '1px solid rgba(140,130,255,0.12)',
        backgroundColor: 'rgba(140,130,255,0.04)',
        p: { xs: 2.5, md: 3 },
      }}
    >
      {children}
    </Box>
  );
}

function EnhancementOptionCard({
  title,
  description,
  subtitle,
  checked,
  onToggle,
}: {
  title: string;
  description: string;
  subtitle?: string;
  checked: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <EnhancementCard>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack spacing={0.5} flex={1}>
          <Typography variant="subtitle2">{title}</Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Stack>
        <Switch
          checked={checked}
          onChange={(event) => onToggle(event.target.checked)}
          color="primary"
        />
      </Stack>
    </EnhancementCard>
  );
}
