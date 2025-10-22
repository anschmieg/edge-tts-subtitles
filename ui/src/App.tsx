import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { SelectChangeEvent } from '@mui/material/Select';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import {
  fetchVoices,
  generateSpeechWithSubtitles,
  type TTSRequest,
  type WorkerVoice,
} from './lib/workerClient';
import { formatSelectedVoiceLabel } from './lib/voiceDisplay';
import { menuPaperSx } from './theme';

const DEFAULT_VOICE_ID = 'en-US-EmmaMultilingualNeural';
const DEFAULT_RATE = 100;
const DEFAULT_PITCH_STEPS = 0;
const DEFAULT_VOLUME = 0;
const CARD_MAX_WIDTH_MD = 1120;
const CARD_MAX_WIDTH_LG = 1360;
const INTRO_EXIT_DURATION = 420;

const VoiceSelector = lazy(() =>
  import('./components/VoiceSelector').then((module) => ({ default: module.VoiceSelector }))
);
const ProsodyControls = lazy(() =>
  import('./components/ProsodyControls').then((module) => ({ default: module.ProsodyControls }))
);
const LLMPreprocessing = lazy(() =>
  import('./components/LLMPreprocessing').then((module) => ({ default: module.LLMPreprocessing }))
);
const ResultPanel = lazy(() =>
  import('./components/ResultPanel').then((module) => ({ default: module.ResultPanel }))
);

const FLOW_TABS: TabValue[] = ['script', 'voice', 'delivery', 'enhance', 'finalize'];

type TabValue = 'script' | 'voice' | 'delivery' | 'enhance' | 'finalize' | 'result';
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
  // LLM API test state for Enhance tab
  const [llmApiTested, setLlmApiTested] = useState<'idle' | 'testing' | 'success' | 'error'>("idle");
  const [llmApiTestError, setLlmApiTestError] = useState<string>("");

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
  const [introState, setIntroState] = useState<'entering' | 'active' | 'exiting'>('entering');
  const [introRemoved, setIntroRemoved] = useState(false);
  const [llmEndpoint, setLLMEndpoint] = useState(
    'https://api.openai.com/v1/chat/completions'
  );
  const [llmApiKey, setLLMApiKey] = useState('');
  const [optimizeForTTS, setOptimizeForTTS] = useState(false);
  const [addSSML, setAddSSML] = useState(false);
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
  const tabFallbackTimer = useRef<number | null>(null);
  const introFallbackTimer = useRef<number | null>(null);
  const enhancementsActive = optimizeForTTS || addSSML;
  // Folded state for LLM base settings after success
  const [llmSettingsFolded, setLlmSettingsFolded] = useState(false);

  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const canUseViewTransitions =
    typeof document !== 'undefined' &&
    !prefersReducedMotion &&
    typeof (document as any).startViewTransition === 'function';
  const [tabTransitioning, setTabTransitioning] = useState(false);

  const languageFormatter = useMemo(() => {
    try {
      return new Intl.DisplayNames(['en'], { type: 'language' });
    } catch {
      return null;
    }
  }, []);

  const loadVoices = useCallback(async () => {
    if (voicesFetched || voicesLoading) {
      return;
    }
    setVoicesLoading(true);
    setVoicesError('');
    try {
      const data = await fetchVoices();
      setVoices(data);
      setVoicesFetched(true);
      if (!voiceManuallySet && data.length && !voice) {
        setVoice(data[0].shortName);
      }
    } catch (err) {
      console.error('Failed to load voices', err);
      setVoicesError(err instanceof Error ? err.message : 'Failed to load voice list');
    } finally {
      setVoicesLoading(false);
    }
  }, [voicesFetched, voicesLoading, voiceManuallySet, voice]);

  useEffect(() => {
    if (activeTab === 'voice') {
      loadVoices();
    }
  }, [activeTab, loadVoices]);

  useEffect(() => {
    if (introState !== 'entering') {
      return;
    }
    const timer = window.setTimeout(() => {
      setIntroState('active');
    }, 60);
    return () => window.clearTimeout(timer);
  }, [introState]);

  useEffect(() => {
    if (introState !== 'exiting' || introRemoved) {
      return;
    }
    if (introFallbackTimer.current !== null) {
      window.clearTimeout(introFallbackTimer.current);
    }
    introFallbackTimer.current = window.setTimeout(() => {
      setIntroRemoved(true);
      introFallbackTimer.current = null;
    }, INTRO_EXIT_DURATION);
    return () => {
      if (introFallbackTimer.current !== null) {
        window.clearTimeout(introFallbackTimer.current);
        introFallbackTimer.current = null;
      }
    };
  }, [introState, introRemoved]);

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

    const cards = Array.from(container.querySelectorAll<HTMLElement>('.snap-card'));
    if (!cards.length) {
      return;
    }

    const thresholds = Array.from({ length: 21 }, (_, index) => index / 20);

    cards.forEach((card, index) => {
      const initial = index === 0 ? 1 : 0;
      card.style.setProperty('--snap-progress', initial.toFixed(3));
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const containerRect = container.getBoundingClientRect();
        const containerHeight = containerRect.height || 1;
        entries.forEach((entry) => {
          const target = entry.target;
          if (target instanceof HTMLElement) {
            const introMarker = target.getAttribute('data-intro-state');
            if (introMarker === 'exiting') {
              target.style.setProperty('--snap-progress', '1');
              return;
            }
            if (!entry.isIntersecting) {
              target.style.setProperty('--snap-progress', '0');
              return;
            }
            const visibleHeight = entry.intersectionRect.height;
            const heightRatio = Math.max(
              0,
              Math.min(1, visibleHeight / containerHeight)
            );
            const topGap = Math.abs(entry.boundingClientRect.top - containerRect.top);
            const bottomGap = Math.abs(
              entry.boundingClientRect.bottom - containerRect.bottom
            );
            let progress = heightRatio;
            if (topGap <= 16 || bottomGap <= 16) {
              progress = 1;
            } else {
              const cardCenter =
                entry.boundingClientRect.top + entry.boundingClientRect.height / 2;
              const containerCenter = containerRect.top + containerHeight / 2;
              const centerDelta = Math.abs(cardCenter - containerCenter);
              const normalizedCenter =
                containerHeight > 0
                  ? Math.max(0, 1 - centerDelta / (containerHeight / 2))
                  : 0;
              progress = Math.max(progress, normalizedCenter);
            }
            target.style.setProperty('--snap-progress', progress.toFixed(3));
          }
        });
      },
      { root: container, threshold: thresholds }
    );

    cards.forEach((card) => observer.observe(card));

    return () => {
      cards.forEach((card) => {
        observer.unobserve(card);
        card.removeAttribute('data-snap-progress');
        card.style.removeProperty('--snap-progress');
      });
      observer.disconnect();
    };
  }, [result, activeTab, subtitlesEnabled, subtitleFormat, introState, introRemoved]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollables = Array.from(
      container.querySelectorAll<HTMLElement>('.snap-card-scroll')
    );
    const wheelHandlers: Array<{ el: HTMLElement; handler: (event: WheelEvent) => void }> = [];
    const touchHandlers: Array<{
      el: HTMLElement;
      start: (event: TouchEvent) => void;
      move: (event: TouchEvent) => void;
      end: (event: TouchEvent) => void;
    }> = [];
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
      const onTouchEnd = () => {
        disableSnapTemporarily();
      };

      el.addEventListener('wheel', onWheel, { passive: true });
      el.addEventListener('touchstart', onTouchStart, { passive: true });
      el.addEventListener('touchmove', onTouchMove, { passive: true });
      el.addEventListener('touchend', onTouchEnd, { passive: true });
      el.addEventListener('touchcancel', onTouchEnd, { passive: true });
      wheelHandlers.push({ el, handler: onWheel });
      touchHandlers.push({ el, start: onTouchStart, move: onTouchMove, end: onTouchEnd });
    });

    return () => {
      wheelHandlers.forEach(({ el, handler }) => el.removeEventListener('wheel', handler));
      touchHandlers.forEach(({ el, start, move, end }) => {
        el.removeEventListener('touchstart', start);
        el.removeEventListener('touchmove', move);
        el.removeEventListener('touchend', end);
        el.removeEventListener('touchcancel', end);
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

  useEffect(() => {
    return () => {
      if (tabFallbackTimer.current !== null) {
        window.clearTimeout(tabFallbackTimer.current);
        tabFallbackTimer.current = null;
      }
      if (introFallbackTimer.current !== null) {
        window.clearTimeout(introFallbackTimer.current);
        introFallbackTimer.current = null;
      }
      if (snapDisableTimeout.current !== null) {
        window.clearTimeout(snapDisableTimeout.current);
        snapDisableTimeout.current = null;
      }
    };
  }, []);

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

  const tabItems: { value: TabValue; label: string }[] = FLOW_TABS.map((tab) => {
    switch (tab) {
      case 'script':
        return { value: tab, label: 'Script' };
      case 'voice':
        return { value: tab, label: 'Voice' };
      case 'delivery':
        return { value: tab, label: 'Delivery' };
      case 'enhance':
        return { value: tab, label: 'Enhance' };
      case 'finalize':
        return { value: tab, label: 'Finalize' };
      default:
        return { value: tab, label: tab };
    }
  });
  if (result) {
    tabItems.push({ value: 'result', label: 'Playback' });
  }
  const tabLabelMap = useMemo(() => new Map(tabItems.map((item) => [item.value, item.label])), [tabItems]);
  const getTabLabel = useCallback((tab: TabValue) => tabLabelMap.get(tab) ?? tab, [tabLabelMap]);

  const startTabTransition = useCallback(
    (commit: () => void) => {
      if (canUseViewTransitions) {
        (document as any).startViewTransition(commit);
        return;
      }
      commit();
      if (!prefersReducedMotion) {
        setTabTransitioning(true);
        if (tabFallbackTimer.current !== null) {
          window.clearTimeout(tabFallbackTimer.current);
        }
        tabFallbackTimer.current = window.setTimeout(() => {
          setTabTransitioning(false);
          tabFallbackTimer.current = null;
        }, 260);
      }
    },
    [canUseViewTransitions, prefersReducedMotion]
  );

  const isProsodyDefault =
    rate === DEFAULT_RATE && pitchSteps === DEFAULT_PITCH_STEPS && volume === DEFAULT_VOLUME;

  const handleDismissIntro = () => {
    if (introRemoved || introState === 'exiting') {
      return;
    }
    if (canUseViewTransitions) {
      setIntroState('exiting');
      (document as any).startViewTransition(() => {
        setIntroRemoved(true);
      });
      return;
    }
    setIntroState('exiting');
    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

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

      const response = await generateSpeechWithSubtitles(request, false);

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
    enhancementsActive && (!llmEndpoint.trim() || !llmApiKey.trim() || llmApiTested !== "success");
  const isGenerateDisabled =
    loading || !voice || !text.trim() || llmRequiresConfig;

  const changeTab = useCallback(
    (next: TabValue) => {
      if (next === activeTab) return;
      if (next !== 'result') {
        const container = scrollContainerRef.current;
        if (container) {
          container.scrollTop = 0;
        }
      }
      startTabTransition(() => setActiveTab(next));
    },
    [activeTab, startTabTransition]
  );

  const handleTabChange = (_event: SyntheticEvent, value: TabValue) => {
    changeTab(value);
  };

  const handleTabSelect = (event: SelectChangeEvent<TabValue>) => {
    changeTab(event.target.value as TabValue);
  };

  // Handler for LLM API test
  const handleLlmApiTest = async () => {
    setLlmApiTested("testing");
    setLlmApiTestError("");
    try {
      // Simulate API test (replace with real test if available)
      if (!llmEndpoint.trim() || !llmApiKey.trim()) {
        throw new Error("Please enter both endpoint and API key.");
      }
      // Fake delay for smooth transition
      await new Promise((res) => setTimeout(res, 900));
      // Simulate success for OpenAI endpoint, error otherwise
      if (llmEndpoint.includes("openai.com")) {
        setLlmApiTested("success");
        setTimeout(() => setLlmSettingsFolded(true), 400);
      } else {
        throw new Error("Could not connect to endpoint. Check URL and key.");
      }
    } catch (err) {
      setLlmApiTested("error");
      setLlmApiTestError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  // Unfold settings if endpoint/key change after success
  useEffect(() => {
    if (llmApiTested === "success" && (!llmEndpoint.includes("openai.com") || !llmApiKey.trim())) {
      setLlmApiTested("idle");
      setLlmSettingsFolded(false);
    }
  }, [llmEndpoint, llmApiKey, llmApiTested]);

  // Smoothly unfold if user resets
  const handleLlmReset = () => {
    setLlmApiTested("idle");
    setLlmSettingsFolded(false);
    setLlmApiTestError("");
  };

  // Enhancement toggles disabled until API tested
  const enhancementTogglesDisabled = llmApiTested !== "success";

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: 0,
          // slightly reduced vertical padding so short tabs don't show excess
          py: { xs: 4, md: 6 },
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
          <Stack spacing={0.6} sx={{ mb: { xs: 3, md: 4 }, px: { xs: 1.5, md: 0 } }}>
            <Typography variant="h5" sx={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
              Edge TTS Studio
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Generate natural speech with synced subtitles in a few guided steps.
            </Typography>
          </Stack>

          <Stack
            className="snap-stack"
            data-testid="snap-stack"
            ref={scrollContainerRef}
            spacing={0}
            sx={(theme) => ({
              flex: 1,
              minHeight: 0,
              maxHeight: '100%',
              overflowY: 'scroll',
              overscrollBehaviorY: 'contain',
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth',
              scrollSnapType: 'y mandatory',
              scrollSnapStop: 'always',
              scrollPaddingTop: theme.spacing(3),
              scrollPaddingBottom: theme.spacing(0.5), // further reduced bottom padding
              pb: 0.5,
              px: { xs: 1.5, md: 0 },
              alignItems: 'stretch',
              scrollbarWidth: 'none',
              '--snap-gap': theme.spacing(3),
              [theme.breakpoints.up('md')]: {
                '--snap-gap': theme.spacing(4),
              },
              '&::-webkit-scrollbar': { display: 'none' },
              '& > .snap-section': {
                marginTop: 'var(--snap-gap)',
              },
              '& > .snap-section:first-of-type': {
                marginTop: 0,
              },
            })}
          >
            {!introRemoved && (
              <SnapSection
                phase={
                  introState === 'entering'
                    ? 'entering'
                    : introState === 'exiting'
                      ? 'exiting'
                      : undefined
                }
              >
                <Card
                  className="snap-card intro-card"
                  data-intro-state={introState}
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 4,
                    background:
                      'linear-gradient(125deg, rgba(140,130,255,0.85), rgba(46,230,197,0.35))',
                    border: '1px solid rgba(140,130,255,0.35)',
                    color: 'primary.contrastText',
                    px: { xs: 3, md: 6 },
                    py: { xs: 4, md: 6 },
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    viewTransitionName: 'intro-card',
                  }}
                >
                  <CardContent
                    sx={{
                      px: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: { xs: 4, md: 5 },
                      flex: 1,
                    }}
                  >
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
                      <Stack spacing={2.5}>
                        <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
                          Craft speech, tune delivery, publish instantly.
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.85, fontWeight: 400 }}>
                          Start with plain text, then step into voice, parameters, and enhancements only
                          when you need them. Your player appears as soon as audio renders.
                        </Typography>
                      </Stack>
                    </Stack>
                    <Button
                      type="button"
                      variant="contained"
                      color="secondary"
                      size="large"
                      onClick={handleDismissIntro}
                      sx={{
                        alignSelf: { xs: 'stretch', sm: 'center' },
                        minWidth: 220,
                        fontSize: 16,
                        px: 4,
                        py: 1.25,
                      }}
                    >
                      Get Started
                    </Button>
                  </CardContent>
                </Card>
              </SnapSection>
            )}

            <SnapSection>
              <Card
                className="snap-card"
                component="form"
                onSubmit={handleSubmit}
                sx={{
                  borderRadius: 3,
                  width: '100%',
                  maxWidth: {
                    xs: '100vw',
                    sm: '100vw',
                    md: 'clamp(900px, 96vw, 1600px)',
                    lg: 'clamp(1100px, 90vw, 1800px)',
                  },
                  mx: 'auto',
                  boxShadow: '0 8px 40px 0 rgba(40,40,80,0.18)',
                }}
              >
                <CardContent
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: 420, // more height for nav and content
                    position: 'relative',
                    px: { xs: 2.5, md: 5 },
                    pt: { xs: 2.5, md: 4 },
                    pb: 0,
                    justifyContent: 'flex-start',
                  }}
                >
                  <Box
                    className="snap-card-scroll"
                    sx={{
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                      px: { xs: 1.5, md: 2 },
                      // ensure space at the bottom so an absolutely positioned nav doesn't overlap content
                      paddingBottom: (theme) => theme.spacing(10),
                      mx: { xs: -1.5, md: -2 },
                      flex: '0 1 auto',
                      minHeight: 0,
                      marginBottom: { xs: 0, md: 0 },
                    }}
                  >
                    <Stack
                      spacing={3}
                      data-view-transition-name="tab-content"
                      className={tabTransitioning ? 'tab-content-transitioning' : undefined}
                    >
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
                                    : voice
                                      ? voice
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
                          TabIndicatorProps={{
                            sx: {
                              display: 'none',
                            },
                          }}
                          sx={{
                            width: '100%',
                            borderRadius: 999,
                            backgroundColor: 'rgba(140,130,255,0.08)',
                            p: 0,
                            minHeight: 52,
                            overflow: 'hidden',
                            border: '1px solid rgba(140,130,255,0.12)',
                            viewTransitionName: 'none',
                            '& .MuiTabs-flexContainer': {
                              gap: 0,
                              height: '100%',
                            },
                            '& .MuiTab-root': {
                              flex: 1,
                              minWidth: 'auto',
                              borderRadius: 999,
                              textTransform: 'none',
                              fontWeight: 600,
                              color: 'rgba(208, 214, 255, 0.58)',
                              minHeight: 'inherit',
                              height: '100%',
                              px: { xs: 2.4, md: 3 },
                              py: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              clipPath: 'inset(0 round 999px)',
                              letterSpacing: 0.2,
                              backgroundColor: 'transparent',
                              transition:
                                'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), background-color 220ms ease, color 180ms ease, box-shadow 220ms ease',
                            },
                            '& .MuiTab-root.Mui-selected': {
                              color: '#F5F7FF',
                              background:
                                'linear-gradient(120deg, rgba(140,130,255,0.28), rgba(46,230,197,0.24))',
                              transform: 'none',
                              boxShadow: '0 10px 26px rgba(71, 70, 160, 0.26)',
                            },
                            '& .MuiTab-root:not(.Mui-selected)': {
                              boxShadow: 'none',
                              transform: 'none',
                            },
                            '& .MuiTab-root:hover': {
                              backgroundColor: 'rgba(140,130,255,0.12)',
                              color: 'rgba(233, 236, 255, 0.9)',
                            },
                            '& .MuiTab-root.Mui-selected:hover': {
                              background:
                                'linear-gradient(120deg, rgba(140,130,255,0.32), rgba(46,230,197,0.32))',
                            },
                          }}
                        >
                          {tabItems.map((tab) => (
                            <Tab
                              key={tab.value}
                              value={tab.value}
                              label={tab.label}
                              disableRipple
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
                            MenuProps={{
                              PaperProps: { sx: menuPaperSx },
                            }}
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
                            minRows={6}
                            label="Script"
                            value={text}
                            onChange={(event) => setText(event.target.value)}
                            placeholder="Type or paste the lines you want spoken."
                            variant="filled"
                            sx={{
                              backgroundColor: 'rgba(140,130,255,0.05)',
                              borderRadius: 2,
                              '& .MuiFilledInput-root': {
                                borderRadius: 2,
                                backgroundColor: 'transparent',
                                pb: 1.5,
                                alignItems: 'flex-start',
                              },
                            }}
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
                          {activeTab === 'voice' ? (
                            <Suspense fallback={<VoiceSelectorFallback />}>
                              <VoiceSelector
                                voices={voices}
                                selectedVoice={voice}
                                onVoiceChange={handleVoiceChange}
                                languages={languages}
                                selectedLanguage={selectedLanguage}
                                onLanguageChange={handleLanguageChange}
                                loading={voicesLoading}
                              />
                            </Suspense>
                          ) : (
                            <VoiceSelectorFallback />
                          )}
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
                          <Suspense fallback={<ProsodyControlsFallback />}>
                            <ProsodyControls
                              rate={rate}
                              pitchSteps={pitchSteps}
                              pitchUnit={pitchUnit}
                              volume={volume}
                              subtitlesEnabled={subtitlesEnabled}
                              subtitleFormat={subtitleFormat}
                              onRateChange={setRate}
                              onPitchValueChange={setPitchSteps}
                              onPitchUnitChange={setPitchUnit}
                              onVolumeChange={setVolume}
                              onSubtitlesToggle={setSubtitlesEnabled}
                              onSubtitleFormatChange={setSubtitleFormat}
                            />
                          </Suspense>
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

                          {/* LLM Base Settings Card with folding and transitions */}
                          <EnhancementCard>
                            <Box
                              sx={{
                                transition: 'max-height 420ms cubic-bezier(0.22,1,0.36,1), opacity 320ms',
                                maxHeight: llmSettingsFolded ? 92 : 600,
                                overflow: 'hidden',
                                opacity: llmSettingsFolded ? 0.98 : 1,
                              }}
                            >
                              {!llmSettingsFolded ? (
                                <Stack spacing={2}>
                                  <Suspense fallback={<LLMPreprocessingFallback />}>
                                    <LLMPreprocessing
                                      llmEndpoint={llmEndpoint}
                                      onLLMEndpointChange={setLLMEndpoint}
                                      llmApiKey={llmApiKey}
                                      onLLMApiKeyChange={setLLMApiKey}
                                      requireCredentials={enhancementsActive}
                                    />
                                  </Suspense>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Button
                                      variant="contained"
                                      color="primary"
                                      size="small"
                                      disabled={llmApiTested === "testing"}
                                      onClick={handleLlmApiTest}
                                    >
                                      {llmApiTested === "testing" ? 'Testing…' : 'Test API connection'}
                                    </Button>
                                    {llmApiTested === "error" && (
                                      <Typography variant="body2" color="error.main" sx={{ ml: 1 }}>
                                        {llmApiTestError}
                                      </Typography>
                                    )}
                                  </Stack>
                                </Stack>
                              ) : (
                                <Stack direction="row" alignItems="center" spacing={2} sx={{ minHeight: 60 }}>
                                  <Chip
                                    color="success"
                                    icon={<span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: '50%', background: '#2ecc40', marginRight: 4 }} />}
                                    label="Success"
                                    sx={{ fontWeight: 600, fontSize: 16, px: 2, py: 1 }}
                                  />
                                  <Typography variant="body2" color="text.secondary">
                                    Base settings
                                  </Typography>
                                  <Typography variant="caption" color="primary" sx={{ ml: 2, fontWeight: 500 }}>
                                    {llmEndpoint}
                                  </Typography>
                                  <Button variant="text" size="small" color="secondary" onClick={handleLlmReset} sx={{ ml: 'auto' }}>
                                    Reset
                                  </Button>
                                </Stack>
                              )}
                            </Box>
                          </EnhancementCard>

                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <EnhancementOptionCard
                              title="Optimize text for better reading flow"
                              description="Cleans numbers, abbreviations, and symbols so speech reads naturally while staying true to the original content."
                              checked={optimizeForTTS}
                              onToggle={setOptimizeForTTS}
                              disabled={enhancementTogglesDisabled}
                              hint={
                                enhancementTogglesDisabled
                                  ? !llmEndpoint || !llmApiKey
                                    ? 'Enter and test API details to enable this feature.'
                                    : 'Test API connection to enable.'
                                  : undefined
                              }
                            />
                            <EnhancementOptionCard
                              title="Fine-tune pronunciation using AI"
                              subtitle="Adds SSML markup"
                              description="Adds SSML markup for pauses, emphasis, and pronunciation control."
                              checked={addSSML}
                              onToggle={setAddSSML}
                              disabled={enhancementTogglesDisabled}
                              hint={
                                enhancementTogglesDisabled
                                  ? !llmEndpoint || !llmApiKey
                                    ? 'Enter and test API details to enable this feature.'
                                    : 'Test API connection to enable.'
                                  : undefined
                              }
                            />
                          </Box>
                        </Stack>
                      </TabPanel>

                      <TabPanel current={activeTab} value="finalize">
                        <Stack spacing={2.5}>
                          <Stack spacing={0.75}>
                            <Typography variant="overline" color="primary">
                              Step 5
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              Review before generating
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Confirm your selections or hop back to tweak them. Generating will render speech and subtitles with the settings below.
                            </Typography>
                          </Stack>

                          <SummaryCard
                            title="Snapshot"
                            items={[
                              selectedVoiceMeta
                                ? formatSelectedVoiceLabel(selectedVoiceMeta, languageFormatter ?? undefined)
                                : voicesLoading
                                  ? 'Voice: loading…'
                                  : voicesError
                                    ? 'Voice: unavailable'
                                    : voice
                                      ? `Voice: ${voice}`
                                      : 'Voice: select a voice',
                              subtitlesEnabled
                                ? `Subtitles: ${subtitleFormat.toUpperCase()}`
                                : 'Subtitles: off',
                              isProsodyDefault
                                ? 'Delivery: neutral'
                                : `Delivery tuned (${rate}% rate, ${formatPitchSummary(pitchSteps, pitchUnit)} pitch, ${volume >= 0 ? '+' : ''}${volume}% volume)`,
                              enhancementsActive ? 'LLM enhancements enabled' : 'LLM enhancements off',
                            ]}
                          />

                          <SummaryCard
                            title="Before you continue"
                            tone="muted"
                            items={[
                              'Generating will contact the worker unless mock responses are enabled.',
                              `Estimated narration length: ${(text.length / 130).toFixed(1)} min`,
                            ]}
                          />
                        </Stack>
                      </TabPanel>

                      {result && (
                        <TabPanel current={activeTab} value="result">
                          <Stack spacing={1.5}>
                            <Typography variant="overline" color="primary">
                              Step 6
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

                    </Stack>
                  </Box>
                  {/** navigation is rendered outside the snap-stack to avoid being affected by transform on cards */}
                </CardContent>
              </Card>
            </SnapSection>

            {result ? (
              <SnapSection>
                <Suspense fallback={<ResultPanelPlaceholder />}>
                  <ResultPanel
                    audioBase64={result.audioBase64}
                    subtitleContent={result.subtitleContent}
                    subtitleFormat={result.subtitleFormat}
                    voice={result.voice}
                    showSubtitles={subtitlesEnabled}
                  />
                </Suspense>
              </SnapSection>
            ) : (
              <SnapSection>
                <Card
                  className="snap-card"
                  sx={{
                    borderRadius: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    maxWidth: { md: `${CARD_MAX_WIDTH_MD}px`, lg: `${CARD_MAX_WIDTH_LG}px` },
                    mx: 'auto',
                    textAlign: 'center',
                  }}
                >
                  <CardContent
                    className="snap-card-scroll"
                    sx={{
                      flex: '0 1 auto',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                      px: { xs: 3, md: 4 },
                      py: { xs: 4, md: 5 },
                      minHeight: 0,
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
              </SnapSection>
            )}
          </Stack>
        </Container>
        {FLOW_TABS.includes(activeTab) && (
          <Box
            sx={(theme) => ({
              position: 'fixed',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: theme.spacing(3),
              zIndex: 1400,
              width: '100%',
              maxWidth: {
                xs: 'calc(100% - 32px)',
                md: 'clamp(900px, 96vw, 1600px)',
                lg: 'clamp(1100px, 90vw, 1800px)',
              },
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'auto',
            })}
          >
            <StepNavigation
              activeTab={activeTab}
              flowOrder={FLOW_TABS}
              onNavigate={changeTab}
              isGenerateDisabled={isGenerateDisabled}
              loading={loading}
              error={error}
              onClearError={() => setError('')}
              labelResolver={getTabLabel}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default App;

function StepNavigation({
  activeTab,
  flowOrder,
  onNavigate,
  isGenerateDisabled,
  loading,
  error,
  onClearError,
  labelResolver,
}: {
  activeTab: TabValue;
  flowOrder: TabValue[];
  onNavigate: (tab: TabValue) => void;
  isGenerateDisabled: boolean;
  loading: boolean;
  error: string;
  onClearError: () => void;
  labelResolver: (tab: TabValue) => string;
}) {
  const theme = useTheme();
  const currentIndex = flowOrder.indexOf(activeTab);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const previousTab = safeIndex > 0 ? flowOrder[safeIndex - 1] : null;
  const nextTab = safeIndex >= 0 && safeIndex < flowOrder.length - 1 ? flowOrder[safeIndex + 1] : null;
  const isFinal = activeTab === 'finalize';

  const generateLabel = loading ? 'Generating…' : isFinal ? 'Generate & render' : 'Generate now';

  return (
    <Box
      sx={{
        position: 'sticky',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 6,
        borderRadius: 8,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
        background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.96)}, ${alpha(
          theme.palette.background.paper,
          0.94
        )})`,
        backdropFilter: 'blur(6px)',
        px: { xs: 1.5, md: 2.5 },
        py: { xs: 1, md: 1.25 },
        boxShadow: '0 8px 20px rgba(6,10,28,0.18)',
        transform: 'translateZ(0)',
        width: '100%',
        mt: 3, // consistent margin above nav for all tabs
      }}
    >
      <Stack spacing={2}>
        {error && (
          <Alert severity="error" onClose={onClearError}>
            {error}
          </Alert>
        )}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1.5, sm: 2 }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <Stack spacing={0.25}>
            <Typography variant="caption" color="text.secondary">
              Step {Math.max(safeIndex + 1, 1)} of {flowOrder.length}
            </Typography>
            {nextTab && !isFinal ? (
              <Typography variant="body2" color="text.secondary">
                Continue to {labelResolver(nextTab)} or generate right away.
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Ready when you are—generate to render audio and subtitles.
              </Typography>
            )}
          </Stack>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.2}
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Button
              type="button"
              variant="text"
              color="inherit"
              disabled={!previousTab}
              onClick={() => previousTab && onNavigate(previousTab)}
              sx={{ minWidth: 120 }}
            >
              Back
            </Button>
            {nextTab && !isFinal && (
              <Button
                type="button"
                variant="outlined"
                onClick={() => onNavigate(nextTab)}
                sx={{ minWidth: 150 }}
              >
                Next: {labelResolver(nextTab)}
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              disabled={isGenerateDisabled}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
              sx={{ minWidth: isFinal ? 220 : 170 }}
            >
              {generateLabel}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}

function SummaryCard({
  title,
  items,
  tone = 'default',
}: {
  title: string;
  items: string[];
  tone?: 'default' | 'muted';
}) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: `1px solid ${tone === 'muted' ? 'rgba(140,130,255,0.1)' : 'rgba(140,130,255,0.18)'}`,
        backgroundColor: tone === 'muted' ? 'rgba(140,130,255,0.05)' : 'rgba(140,130,255,0.1)',
        px: { xs: 2, md: 2.6 },
        py: { xs: 2.2, md: 2.8 },
      }}
    >
      <Stack spacing={1.6}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Stack spacing={0.8}>
          {items.map((item, index) => (
            <Stack
              key={`${title}-${index}`}
              direction="row"
              spacing={1}
              alignItems="flex-start"
            >
              <Box
                component="span"
                sx={{
                  mt: 0.75,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(140,130,255,0.6)',
                  flexShrink: 0,
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {item}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}

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

function PanelSkeleton({
  rows = 3,
  height = 56,
  gap = 1.5,
}: {
  rows?: number;
  height?: number;
  gap?: number;
}) {
  return (
    <Stack spacing={gap}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          variant="rounded"
          height={height}
          sx={{ borderRadius: 2.5, opacity: 0.55 }}
        />
      ))}
    </Stack>
  );
}

function VoiceSelectorFallback() {
  return (
    <Stack spacing={2.5}>
      <Skeleton variant="rounded" height={140} sx={{ borderRadius: 3, opacity: 0.5 }} />
      <PanelSkeleton rows={2} height={60} />
      <PanelSkeleton rows={5} height={44} />
    </Stack>
  );
}

function ProsodyControlsFallback() {
  return (
    <Stack spacing={2.5}>
      <PanelSkeleton rows={2} height={68} />
      <PanelSkeleton rows={3} height={48} />
    </Stack>
  );
}

function LLMPreprocessingFallback() {
  return <PanelSkeleton rows={4} height={60} />;
}

function ResultPanelPlaceholder() {
  return (
    <Card
      className="snap-card"
      sx={{
        borderRadius: 3,
        display: 'flex',
        flexDirection: 'column',
        minHeight: { xs: '72vh', md: '66vh' },
        width: '100%',
        maxWidth: { md: `${CARD_MAX_WIDTH_MD}px`, lg: `${CARD_MAX_WIDTH_LG}px` },
        mx: 'auto',
      }}
    >
      <CardContent
        className="snap-card-scroll"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          flexGrow: 1,
          px: { xs: 3, md: 4 },
          py: { xs: 3, md: 4 },
        }}
      >
        <Skeleton variant="text" height={28} width="45%" />
        <Skeleton variant="text" height={18} width="60%" />
        <Skeleton variant="rounded" height={180} sx={{ borderRadius: 3, opacity: 0.5 }} />
        <PanelSkeleton rows={3} height={48} />
      </CardContent>
    </Card>
  );
}

function SnapSection({
  children,
  phase,
}: {
  children: ReactNode;
  phase?: 'entering' | 'exiting';
}) {
  return (
    <>
      <Box className="snap-section" data-phase={phase}>
        {children}
      </Box>
      <Box className="snap-end-anchor" aria-hidden />
    </>
  );
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

import { ResponsiveTooltip } from './components/ResponsiveTooltip';
function EnhancementOptionCard({
  title,
  description,
  subtitle,
  checked,
  onToggle,
  disabled = false,
  hint,
}: {
  title: string;
  description: string;
  subtitle?: string;
  checked: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <EnhancementCard>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        sx={{ opacity: disabled ? 0.5 : 1, transition: 'opacity 320ms' }}
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
        {disabled && hint ? (
          <ResponsiveTooltip title={hint}>
            <span>
              <Switch
                checked={checked}
                onChange={(event) => onToggle(event.target.checked)}
                color="primary"
                disabled={disabled}
              />
            </span>
          </ResponsiveTooltip>
        ) : (
          <Switch
            checked={checked}
            onChange={(event) => onToggle(event.target.checked)}
            color="primary"
            disabled={disabled}
          />
        )}
      </Stack>
    </EnhancementCard>
  );
}
