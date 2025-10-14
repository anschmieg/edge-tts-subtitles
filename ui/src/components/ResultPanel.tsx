import { useEffect, useState, useRef } from 'react';
import { parseSubtitles, findActiveCue, type SubtitleCue } from '../lib/subtitle';
import { downloadAudio, downloadSubtitle, createAudioURL } from '../lib/workerClient';
import { downloadZip } from '../lib/zip';

interface ResultPanelProps {
  audioBase64: string;
  subtitleContent: string;
  subtitleFormat: 'srt' | 'vtt';
  voice: string;
}

export function ResultPanel({
  audioBase64,
  subtitleContent,
  subtitleFormat,
  voice,
}: ResultPanelProps) {
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [activeCueId, setActiveCueId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeCueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create audio URL from base64
    const url = createAudioURL(audioBase64);
    setAudioUrl(url);

    // Parse subtitles
    const parsedCues = parseSubtitles(subtitleContent, subtitleFormat);
    setCues(parsedCues);

    // Clean up on unmount
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [audioBase64, subtitleContent, subtitleFormat]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;

      // Find active cue
      const activeCue = findActiveCue(cues, time);
      setActiveCueId(activeCue?.id || null);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [cues]);

  // Auto-scroll to active cue
  useEffect(() => {
    if (activeCueRef.current) {
      activeCueRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeCueId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownloadZip = async () => {
    try {
      await downloadZip(audioBase64, subtitleContent, subtitleFormat);
    } catch (error) {
      console.error('Error downloading ZIP:', error);
      alert('Failed to download ZIP file');
    }
  };

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown} tabIndex={0}>
      <h2 className="text-xl font-semibold text-gray-800">Result</h2>

      {/* Audio Player */}
      <div className="bg-gray-50 rounded-lg p-4">
        <audio
          ref={audioRef}
          src={audioUrl}
          controls
          className="w-full mb-3"
        />

        <div className="text-sm text-gray-600 space-y-1">
          <div>
            <span className="font-medium">Voice:</span> {voice}
          </div>
          <div>
            <span className="font-medium">Duration:</span> {formatTime(duration)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Keyboard shortcuts: Space = play/pause, ← → = seek ±5s
          </div>
        </div>
      </div>

      {/* Download Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => downloadAudio(audioBase64)}
          className="btn-secondary flex-1 sm:flex-none"
        >
          Download MP3
        </button>
        <button
          onClick={() => downloadSubtitle(subtitleContent, subtitleFormat)}
          className="btn-secondary flex-1 sm:flex-none"
        >
          Download {subtitleFormat.toUpperCase()}
        </button>
        <button
          onClick={handleDownloadZip}
          className="btn-primary flex-1 sm:flex-none"
        >
          Download ZIP
        </button>
      </div>

      {/* Subtitles */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Subtitles</h3>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {cues.map((cue) => (
            <div
              key={cue.id}
              ref={cue.id === activeCueId ? activeCueRef : null}
              className={`subtitle-cue ${
                cue.id === activeCueId ? 'subtitle-cue-active' : ''
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">
                {formatTime(cue.startTime / 1000)} → {formatTime(cue.endTime / 1000)}
              </div>
              <div className="text-sm text-gray-800">{cue.text}</div>
            </div>
          ))}
        </div>
        
        {/* TODO: Per-word highlighting */}
        <div className="mt-3 text-xs text-gray-500 italic">
          Note: Per-word highlighting is not yet implemented. The worker would need to provide
          word-level timestamps for precise per-word synchronization. Current implementation
          highlights the active subtitle cue.
        </div>
      </div>
    </div>
  );
}
