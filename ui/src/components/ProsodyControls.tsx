import { RATE_PRESETS, PITCH_PRESETS, VOLUME_PRESETS } from '../constants';

interface ProsodyControlsProps {
  rate: string;
  pitch: string;
  volume: string;
  onRateChange: (rate: string) => void;
  onPitchChange: (pitch: string) => void;
  onVolumeChange: (volume: string) => void;
}

export function ProsodyControls({
  rate,
  pitch,
  volume,
  onRateChange,
  onPitchChange,
  onVolumeChange,
}: ProsodyControlsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Prosody Controls</h3>

      {/* Rate */}
      <div>
        <label className="label">Rate</label>
        <div className="flex gap-2 mb-2">
          {RATE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onRateChange(preset.value)}
              className={`px-3 py-1 text-sm rounded ${
                rate === preset.value
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={rate}
          onChange={(e) => onRateChange(e.target.value)}
          placeholder="e.g., 1.0, slow, fast"
          className="input-text"
        />
      </div>

      {/* Pitch */}
      <div>
        <label className="label">Pitch</label>
        <div className="flex gap-2 mb-2">
          {PITCH_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onPitchChange(preset.value)}
              className={`px-3 py-1 text-sm rounded ${
                pitch === preset.value
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={pitch}
          onChange={(e) => onPitchChange(e.target.value)}
          placeholder="e.g., +2st, -1st, high, low"
          className="input-text"
        />
      </div>

      {/* Volume */}
      <div>
        <label className="label">Volume</label>
        <div className="flex gap-2 mb-2">
          {VOLUME_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onVolumeChange(preset.value)}
              className={`px-3 py-1 text-sm rounded ${
                volume === preset.value
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={volume}
          onChange={(e) => onVolumeChange(e.target.value)}
          placeholder="e.g., medium, loud, soft"
          className="input-text"
        />
      </div>
    </div>
  );
}
