import { Grid, Slider, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import InputAdornment from '@mui/material/InputAdornment';

type PitchUnit = 'percent' | 'hz' | 'semitone';

interface ProsodyControlsProps {
  rate: number;
  pitchSteps: number;
  pitchUnit: PitchUnit;
  volume: number;
  onRateChange: (rate: number) => void;
  onPitchValueChange: (steps: number) => void;
  onPitchUnitChange: (unit: PitchUnit) => void;
  onVolumeChange: (volume: number) => void;
}

export function ProsodyControls({
  rate,
  pitchSteps,
  pitchUnit,
  volume,
  onRateChange,
  onPitchValueChange,
  onPitchUnitChange,
  onVolumeChange,
}: ProsodyControlsProps) {
  const pitchDisplayValue = convertSemitoneToUnit(pitchSteps, pitchUnit);
  const pitchRange = getPitchRange(pitchUnit);

  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          Fine-tune pace, tone, and loudness.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Neutral values keep the original voice character. Adjust only when you need a specific delivery.
        </Typography>
      </Stack>

      <SliderRow
        label="Rate"
        description="0–200% · Default 100%"
        min={0}
        max={200}
        step={1}
        value={rate}
        onChange={onRateChange}
        adornment="%"
      />

      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Pitch
          </Typography>
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
              '& .MuiToggleButton-root': {
                borderRadius: 999,
                textTransform: 'none',
                px: 1.5,
              },
            }}
          >
            <ToggleButton value="percent">% change</ToggleButton>
            <ToggleButton value="hz">Hz shift</ToggleButton>
            <ToggleButton value="semitone">Half notes</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <SliderRow
          label="Adjustment"
          description={getPitchHelper(pitchUnit)}
          min={pitchRange.min}
          max={pitchRange.max}
          step={pitchRange.step}
          value={pitchDisplayValue}
          onChange={(value) => onPitchValueChange(convertUnitToSemitone(value, pitchUnit))}
          adornment={getPitchSuffix(pitchUnit)}
        />
      </Stack>

      <SliderRow
        label="Volume"
        description="−50 to +50 · Default 0"
        min={-50}
        max={50}
        step={1}
        value={volume}
        onChange={onVolumeChange}
        adornment="%"
      />
    </Stack>
  );
}

interface SliderRowProps {
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  value: number;
  adornment: string;
  onChange: (value: number) => void;
}

function SliderRow({ label, description, min, max, step, value, adornment, onChange }: SliderRowProps) {
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
    <Stack spacing={1.25}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {description}
        </Typography>
      </Stack>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md>
          <Slider
            value={clamped}
            min={min}
            max={max}
            step={step}
            onChange={handleSliderChange}
            sx={{
              height: 4,
              '& .MuiSlider-thumb': {
                width: 14,
                height: 14,
              },
            }}
          />
        </Grid>
        <Grid item>
          <TextField
            value={clamped}
            onChange={handleInputChange}
            size="small"
            sx={{ width: 96 }}
            InputProps={{
              inputProps: { step, min, max },
              endAdornment: <InputAdornment position="end">{adornment}</InputAdornment>,
            }}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
