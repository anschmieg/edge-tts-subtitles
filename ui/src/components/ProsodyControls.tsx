import { Box, Slider, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

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
  const displayPitchValue = convertSemitoneToUnit(pitchSteps, pitchUnit);
  const { min, max, step } = getPitchRange(pitchUnit);

  return (
    <Stack spacing={3}>
      <Typography variant="body2" color="text.secondary">
        Fine-tune pace, tone, and loudness. Neutral values keep the original voice character.
      </Typography>

      <SliderField
        label="Rate"
        helper="0–200% · Default 100%"
        min={0}
        max={200}
        step={1}
        value={rate}
        onSliderChange={onRateChange}
        onInputChange={onRateChange}
        inputSuffix="%"
      />

      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Typography variant="subtitle2" color="text.secondary">
            Pitch
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={pitchUnit}
            onChange={(_, newUnit: PitchUnit | null) => {
              if (!newUnit || newUnit === pitchUnit) return;
              const semitoneValue = convertUnitToSemitone(displayPitchValue, pitchUnit);
              onPitchUnitChange(newUnit);
              onPitchValueChange(semitoneValue);
            }}
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                borderRadius: 999,
              },
            }}
          >
            <ToggleButton value="percent">% change</ToggleButton>
            <ToggleButton value="hz">Hz shift</ToggleButton>
            <ToggleButton value="semitone">Half notes</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <SliderField
          label="Adjustment"
          helper={getPitchHelper(pitchUnit)}
          min={min}
          max={max}
          step={step}
          value={displayPitchValue}
          onSliderChange={(value) => onPitchValueChange(convertUnitToSemitone(value, pitchUnit))}
          onInputChange={(value) => onPitchValueChange(convertUnitToSemitone(value, pitchUnit))}
          inputSuffix={getPitchSuffix(pitchUnit)}
        />
      </Stack>

      <SliderField
        label="Volume"
        helper="+ is louder · − is softer"
        min={-50}
        max={50}
        step={1}
        value={volume}
        onSliderChange={onVolumeChange}
        onInputChange={onVolumeChange}
        inputSuffix="%"
      />
    </Stack>
  );
}

interface SliderFieldProps {
  label: string;
  helper: string;
  min: number;
  max: number;
  step: number;
  value: number;
  inputSuffix: string;
  onSliderChange: (value: number) => void;
  onInputChange: (value: number) => void;
}

function SliderField({
  label,
  helper,
  min,
  max,
  step,
  value,
  inputSuffix,
  onSliderChange,
  onInputChange,
}: SliderFieldProps) {
  const clampValue = (val: number) => Math.max(min, Math.min(max, val));

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
        <Slider
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(_, newValue) => onSliderChange(clampValue(Number(newValue)))}
          sx={{ flexGrow: 1 }}
          valueLabelDisplay="auto"
        />
        <Box sx={{ width: 110 }}>
          <TextField
            type="number"
            size="small"
            value={Number.isFinite(value) ? value : 0}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              if (Number.isFinite(parsed)) {
                onInputChange(clampValue(parsed));
              }
            }}
            InputProps={{
              endAdornment: (
                <Typography variant="caption" color="text.secondary">
                  {inputSuffix}
                </Typography>
              ),
              inputProps: { step, min, max },
            }}
          />
        </Box>
      </Stack>
    </Stack>
  );
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
      return '+ raises pitch · − lowers pitch (percent change)';
    case 'hz':
      return '+ raises pitch · − lowers pitch (approximate Hz)';
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
