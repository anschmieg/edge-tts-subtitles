import { useMemo } from 'react';
import {
  Box,
  Button,
  Chip,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import InputAdornment from '@mui/material/InputAdornment';
import { alpha, useTheme } from '@mui/material/styles';

type PitchUnit = 'percent' | 'hz' | 'semitone';

interface ProsodyControlsProps {
  rate: number;
  pitchSteps: number;
  pitchUnit: PitchUnit;
  volume: number;
  subtitlesEnabled: boolean;
  subtitleFormat: 'srt' | 'vtt';
  onRateChange: (rate: number) => void;
  onPitchValueChange: (steps: number) => void;
  onPitchUnitChange: (unit: PitchUnit) => void;
  onVolumeChange: (volume: number) => void;
  onSubtitlesToggle: (value: boolean) => void;
  onSubtitleFormatChange: (format: 'srt' | 'vtt') => void;
}

const DEFAULTS = {
  rate: 100,
  pitchSteps: 0,
  volume: 0,
};

const DELIVERY_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  rate: number;
  pitchSteps: number;
  volume: number;
}> = [
  {
    id: 'neutral',
    label: 'Neutral',
    description: 'Balanced pace with default tone and loudness.',
    rate: 100,
    pitchSteps: 0,
    volume: 0,
  },
  {
    id: 'conversational',
    label: 'Conversational',
    description: 'Slightly slower with a relaxed pitch for friendly scripts.',
    rate: 94,
    pitchSteps: -0.5,
    volume: -2,
  },
  {
    id: 'energetic',
    label: 'Energetic',
    description: 'Faster tempo, brighter pitch, and added presence.',
    rate: 110,
    pitchSteps: 1.2,
    volume: 4,
  },
  {
    id: 'broadcast',
    label: 'Broadcast',
    description: 'Measured pacing with subtle lift for professional reads.',
    rate: 102,
    pitchSteps: 0.6,
    volume: 2,
  },
];

export function ProsodyControls({
  rate,
  pitchSteps,
  pitchUnit,
  volume,
  subtitlesEnabled,
  subtitleFormat,
  onRateChange,
  onPitchValueChange,
  onPitchUnitChange,
  onVolumeChange,
  onSubtitlesToggle,
  onSubtitleFormatChange,
}: ProsodyControlsProps) {
  const theme = useTheme();
  const pitchDisplayValue = convertSemitoneToUnit(pitchSteps, pitchUnit);
  const pitchRange = getPitchRange(pitchUnit);

  const activePreset = useMemo(() => {
    return DELIVERY_PRESETS.find((preset) =>
      approximatelyEqual(rate, preset.rate) &&
      approximatelyEqual(pitchSteps, preset.pitchSteps) &&
      approximatelyEqual(volume, preset.volume)
    )?.id;
  }, [rate, pitchSteps, volume]);

  const handlePresetSelect = (presetId: string) => {
    const preset = DELIVERY_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    onRateChange(preset.rate);
    onPitchValueChange(preset.pitchSteps);
    onPitchUnitChange('semitone');
    onVolumeChange(preset.volume);
  };

  const handleReset = () => {
    onRateChange(DEFAULTS.rate);
    onPitchValueChange(DEFAULTS.pitchSteps);
    onPitchUnitChange('semitone');
    onVolumeChange(DEFAULTS.volume);
  };

  const gradientSurface = `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.14)}, ${alpha(
    theme.palette.primary.main,
    0.06
  )})`;

  return (
    <Stack spacing={3} sx={{ position: 'relative' }}>
      <Stack spacing={1}>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          Fine-tune the performance.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Choose a preset for a quick starting point, then dial in the details below.
        </Typography>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        {DELIVERY_PRESETS.map((preset) => {
          const selected = activePreset === preset.id;
          return (
            <Button
              key={preset.id}
              onClick={() => handlePresetSelect(preset.id)}
              variant={selected ? 'contained' : 'outlined'}
              color={selected ? 'primary' : 'inherit'}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                minHeight: 96,
                borderRadius: 3,
                alignItems: 'flex-start',
                background: selected ? gradientSurface : alpha(theme.palette.primary.main, 0.06),
                borderColor: alpha(theme.palette.primary.main, selected ? 0.24 : 0.16),
                color: selected ? theme.palette.primary.contrastText : theme.palette.text.secondary,
                px: 2.2,
                py: 1.8,
                '&:hover': {
                  background: selected
                    ? gradientSurface
                    : alpha(theme.palette.primary.main, 0.12),
                  borderColor: alpha(theme.palette.primary.main, 0.3),
                },
              }}
            >
              <Stack spacing={0.5} alignItems="flex-start">
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {preset.label}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {preset.description}
                </Typography>
              </Stack>
            </Button>
          );
        })}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 1.8,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        <SliderCard
          title="Rate"
          helper="0–200% · Default 100%"
          value={rate}
          min={0}
          max={200}
          step={1}
          adornment="%"
          onChange={onRateChange}
        />

        <SliderCard
          title="Volume"
          helper="−50 to +50 · Default 0"
          value={volume}
          min={-50}
          max={50}
          step={1}
          adornment="%"
          onChange={onVolumeChange}
        />

        <SliderCard
          title="Pitch"
          helper={getPitchHelper(pitchUnit)}
          value={pitchDisplayValue}
          min={pitchRange.min}
          max={pitchRange.max}
          step={pitchRange.step}
          adornment={getPitchSuffix(pitchUnit)}
          onChange={(value) => onPitchValueChange(convertUnitToSemitone(value, pitchUnit))}
          action={
            <ToggleButtonGroup
              size="small"
              exclusive
              value={pitchUnit}
              onChange={(_, nextUnit: PitchUnit | null) => {
                if (!nextUnit || nextUnit === pitchUnit) return;
                const semitone = convertUnitToSemitone(pitchDisplayValue, pitchUnit);
                onPitchUnitChange(nextUnit);
                onPitchValueChange(semitone);
              }}
              sx={{
                backgroundColor: alpha(theme.palette.primary.main, 0.06),
                borderRadius: 999,
                '& .MuiToggleButton-root': {
                  border: 'none',
                  borderRadius: 999,
                  textTransform: 'none',
                  px: 1.4,
                  py: 0.4,
                },
              }}
            >
              <ToggleButton value="percent">% change</ToggleButton>
              <ToggleButton value="hz">Hz shift</ToggleButton>
              <ToggleButton value="semitone">Half notes</ToggleButton>
            </ToggleButtonGroup>
          }
        />

        <Box
          sx={{
            borderRadius: 3,
            background: alpha(theme.palette.primary.main, 0.06),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
            px: { xs: 2, md: 2.5 },
            py: { xs: 2.4, md: 2.8 },
            display: 'flex',
            flexDirection: 'column',
            gap: 1.6,
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Subtitle export
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Generate captions with each render. Choose the format that fits your workflow.
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Include subtitles
              </Typography>
              <Switch
                checked={subtitlesEnabled}
                onChange={(event) => onSubtitlesToggle(event.target.checked)}
                color="primary"
              />
            </Stack>
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            alignItems="center"
            sx={{ opacity: subtitlesEnabled ? 1 : 0.4 }}
          >
            <Chip
              label="SubRip (.srt)"
              clickable
              color={subtitleFormat === 'srt' ? 'primary' : 'default'}
              variant={subtitleFormat === 'srt' ? 'filled' : 'outlined'}
              onClick={() => onSubtitleFormatChange('srt')}
              sx={{ borderRadius: 999 }}
              disabled={!subtitlesEnabled}
            />
            <Chip
              label="WebVTT (.vtt)"
              clickable
              color={subtitleFormat === 'vtt' ? 'primary' : 'default'}
              variant={subtitleFormat === 'vtt' ? 'filled' : 'outlined'}
              onClick={() => onSubtitleFormatChange('vtt')}
              sx={{ borderRadius: 999 }}
              disabled={!subtitlesEnabled}
            />
          </Stack>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="text" color="inherit" onClick={handleReset} sx={{ textTransform: 'none' }}>
          Reset to neutral
        </Button>
      </Box>
    </Stack>
  );
}

interface SliderCardProps {
  title: string;
  helper: string;
  min: number;
  max: number;
  step: number;
  value: number;
  adornment: string;
  onChange: (value: number) => void;
  action?: React.ReactNode;
}

function SliderCard({ title, helper, min, max, step, value, adornment, onChange, action }: SliderCardProps) {
  const theme = useTheme();
  const clamped = clamp(value, min, max);

  const handleSliderChange = (_: Event, sliderValue: number | number[]) => {
    const next = Array.isArray(sliderValue) ? sliderValue[0] : sliderValue;
    onChange(clamp(next, min, max));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    if (Number.isFinite(next)) {
      onChange(clamp(next, min, max));
    }
  };

  return (
    <Box
      sx={{
        borderRadius: 3,
        background: alpha(theme.palette.primary.main, 0.06),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
        px: { xs: 2, md: 2.5 },
        py: { xs: 2.3, md: 2.7 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.6,
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <Stack spacing={0.4}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {helper}
          </Typography>
        </Stack>
        {action ? <Box>{action}</Box> : null}
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
        <Slider
          value={clamped}
          min={min}
          max={max}
          step={step}
          onChange={handleSliderChange}
          sx={{
            flex: 1,
            height: 4,
            color: theme.palette.primary.light,
            '& .MuiSlider-thumb': {
              width: 18,
              height: 18,
              border: `2px solid ${alpha(theme.palette.primary.main, 0.35)}`,
            },
          }}
        />
        <TextField
          value={clamped}
          onChange={handleInputChange}
          size="small"
          sx={{ width: 110 }}
          InputProps={{
            inputProps: { step, min, max },
            endAdornment: <InputAdornment position="end">{adornment}</InputAdornment>,
          }}
        />
      </Stack>
    </Box>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function approximatelyEqual(a: number, b: number, tolerance = 0.5) {
  return Math.abs(a - b) <= tolerance;
}

function convertSemitoneToUnit(steps: number, unit: PitchUnit): number {
  switch (unit) {
    case 'percent':
      return Number(((steps / 12) * 100).toFixed(1));
    case 'hz':
      return Number((steps * 100).toFixed(0));
    case 'semitone':
    default:
      return Number(steps.toFixed(2));
  }
}

function convertUnitToSemitone(value: number, unit: PitchUnit): number {
  switch (unit) {
    case 'percent':
      return Number(((value / 100) * 12).toFixed(2));
    case 'hz':
      return Number((value / 100).toFixed(2));
    case 'semitone':
    default:
      return Number(value.toFixed(2));
  }
}

function getPitchRange(unit: PitchUnit) {
  switch (unit) {
    case 'percent':
      return { min: -50, max: 50, step: 1 };
    case 'hz':
      return { min: -600, max: 600, step: 20 };
    case 'semitone':
    default:
      return { min: -12, max: 12, step: 0.5 };
  }
}

function getPitchHelper(unit: PitchUnit): string {
  switch (unit) {
    case 'percent':
      return 'Positive values raise the pitch (%)';
    case 'hz':
      return 'Positive values raise the pitch (Hz)';
    case 'semitone':
    default:
      return '+ raises pitch · − lowers pitch (half notes)';
  }
}

function getPitchSuffix(unit: PitchUnit): string {
  switch (unit) {
    case 'percent':
      return '%';
    case 'hz':
      return 'Hz';
    case 'semitone':
    default:
      return 'st';
  }
}
