import { useState } from 'react';
import { EXAMPLE_VOICES } from '../constants';
import { generateSpeechWithSubtitles, createAudioURL } from '../lib/workerClient';

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
}

export function VoiceSelector({ selectedVoice, onVoiceChange }: VoiceSelectorProps) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const handlePlayDemo = async (voiceId: string, demoText: string) => {
    // Stop any currently playing audio
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      URL.revokeObjectURL(audioElement.src);
    }

    setPlayingVoice(voiceId);

    try {
      // Generate demo audio (using worker in production or mock in dev)
      const response = await generateSpeechWithSubtitles({
        input: demoText,
        voice: voiceId,
      }, false); // Set to true for mock mode during development

      const audioUrl = createAudioURL(response.audio_content_base64);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setPlayingVoice(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setPlayingVoice(null);
        URL.revokeObjectURL(audioUrl);
      };

      setAudioElement(audio);
      await audio.play();
    } catch (error) {
      console.error('Error playing demo:', error);
      setPlayingVoice(null);
      alert('Failed to play demo. Make sure the worker is running.');
    }
  };

  return (
    <div className="space-y-3">
      <label className="label">Voice</label>
      <select
        value={selectedVoice}
        onChange={(e) => onVoiceChange(e.target.value)}
        className="input-text"
      >
        {EXAMPLE_VOICES.map((voice) => (
          <option key={voice.id} value={voice.id}>
            {voice.name}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {EXAMPLE_VOICES.map((voice) => (
          <button
            key={voice.id}
            type="button"
            onClick={() => handlePlayDemo(voice.id, voice.demoText ?? voice.name)}
            disabled={playingVoice === voice.id}
            className="btn-secondary text-sm py-1.5"
          >
            {playingVoice === voice.id ? '▶ Playing...' : `▶ Play ${voice.name.split('(')[0].trim()}`}
          </button>
        ))}
      </div>
    </div>
  );
}
