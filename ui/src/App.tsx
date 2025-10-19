import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  FormControlLabel,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
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
  const [text, setText] = useState(
    'Hello, world! This is a test of the Edge TTS Subtitles service.'
  );
  const [voices, setVoices] = useState<WorkerVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState<string>('');
  const [voice, setVoice] = useState<string | null>(null);
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

  const languageFormatter = useMemo(() => {
    try {
      return new Intl.DisplayNames(['en'], { type: 'language' });
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setVoicesLoading(true);
    setVoicesError('');
    fetchVoices()
      .then((data) => {
        if (cancelled) return;
        setVoices(data);
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
  }, []);

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
  const enhancementsActive = optimizeForTTS || addSSML;
  const llmRequiresConfig =
    enhancementsActive && (!llmEndpoint.trim() || !llmApiKey.trim());
  const isGenerateDisabled =
    loading || !voice || !text.trim() || llmRequiresConfig;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: 'divider', backdropFilter: 'blur(12px)' }}
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
        }}
      >
        <Container
          maxWidth="md"
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            px: { xs: 0, md: 1 },
          }}
        >
          <Stack
            spacing={{ xs: 3, md: 4 }}
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              scrollSnapType: 'y mandatory',
              pb: 4,
              pr: { xs: 1, md: 2 },
              pl: { xs: 1, md: 2 },
            }}
          >
            <Card
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 4,
                background: 'linear-gradient(125deg, rgba(140,130,255,0.85), rgba(46,230,197,0.35))',
                border: '1px solid rgba(140,130,255,0.35)',
                color: 'primary.contrastText',
                px: { xs: 3, md: 6 },
                py: { xs: 4, md: 6 },
                minHeight: { xs: 'calc(100vh - 200px)', md: 'calc(100vh - 260px)' },
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
              }}
            >
              <CardContent sx={{ px: 0 }}>
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
              component="form"
              onSubmit={handleSubmit}
              sx={{
                borderRadius: 3,
                minHeight: { xs: 'calc(100vh - 200px)', md: 'calc(100vh - 260px)' },
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
              }}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
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

                <Tabs
                  value={activeTab}
                  onChange={(_, value) => setActiveTab(value as TabValue)}
                  variant="scrollable"
                  scrollButtons="auto"
                  allowScrollButtonsMobile
                  textColor="primary"
                  indicatorColor="primary"
                  sx={{
                    borderRadius: 2,
                    backgroundColor: 'rgba(140,130,255,0.08)',
                    px: 1,
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
                    '& .MuiTabs-indicator': {
                      height: 4,
                      borderRadius: 2,
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

                <Divider />

                <TabPanel current={activeTab} value="script">
                  <Stack spacing={1.5}>
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
                        <Typography variant="body2" color="text.secondary">
                          Choose a language to filter the catalog. Preview playback stays open so you
                          can audition multiple voices quickly.
                        </Typography>
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
                        <Typography variant="subtitle1">Subtitles & downloads</Typography>
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
                    <Stack spacing={0.25}>
                      <Typography variant="subtitle1">LLM enhancements</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Combine these optional AI helpers with your own endpoint. Credentials stay in
                        the browser.
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
                      description="Adds SSML markup for pauses, emphasis, and pronunciation control."
                      subtitle="Adds SSML markup"
                      checked={addSSML}
                      onToggle={setAddSSML}
                    />
                  </Stack>
                </TabPanel>

                {result && (
                  <TabPanel current={activeTab} value="result">
                    <ResultPanel
                      audioBase64={result.audioBase64}
                      subtitleContent={result.subtitleContent}
                      subtitleFormat={result.subtitleFormat}
                      voice={result.voice}
                      showSubtitles={subtitlesEnabled}
                    />
                  </TabPanel>
                )}

                <Divider />

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  justifyContent="space-between"
                >
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
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isGenerateDisabled}
                    startIcon={
                      loading ? <CircularProgress size={18} color="inherit" /> : undefined
                    }
                    sx={{ minWidth: 200 }}
                  >
                    {loading ? 'Generating…' : 'Generate speech'}
                  </Button>
                </Stack>

                <Collapse in={Boolean(error)}>
                  <Alert severity="error" onClose={() => setError('')}>
                    {error}
                  </Alert>
                </Collapse>
              </CardContent>
            </Card>

            {!result && (
              <Card
                sx={{
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: { xs: 4, md: 6 },
                  textAlign: 'center',
                  minHeight: { xs: 'calc(100vh - 200px)', md: 'calc(100vh - 260px)' },
                  scrollSnapAlign: 'start',
                  scrollSnapStop: 'always',
                }}
              >
                <Stack spacing={2} alignItems="center">
                  <Typography variant="h6">Your rendered audio will appear here.</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
                    Step through the tabs: enter text, audition voices, tweak delivery, optionally
                    enhance with LLM, then generate to unlock the playback tab.
                  </Typography>
                </Stack>
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
