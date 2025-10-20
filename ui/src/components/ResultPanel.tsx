import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import SubtitlesRoundedIcon from '@mui/icons-material/SubtitlesRounded';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import HeadphonesRoundedIcon from '@mui/icons-material/HeadphonesRounded';
import { parseSubtitles, findActiveCue, type SubtitleCue } from '../lib/subtitle';
import { downloadAudio, downloadSubtitle } from '../lib/workerClient';
import { downloadZip } from '../lib/zip';
import { createAudioURL } from '../lib/workerClient';

interface ResultPanelProps {
  audioBase64: string;
  subtitleContent: string;
  subtitleFormat: 'srt' | 'vtt';
  voice: string;
  showSubtitles: boolean;
}

export function ResultPanel({
  audioBase64,
  subtitleContent,
  subtitleFormat,
  voice,
  showSubtitles,
}: ResultPanelProps) {
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [activeCueId, setActiveCueId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeCueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = createAudioURL(audioBase64);
    setAudioUrl(url);

    if (showSubtitles && subtitleContent) {
      const parsedCues = parseSubtitles(subtitleContent, subtitleFormat);
      setCues(parsedCues);
    } else {
      setCues([]);
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [audioBase64, subtitleContent, subtitleFormat, showSubtitles]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
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

  useEffect(() => {
    if (activeCueRef.current) {
      activeCueRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeCueId]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (event.code === 'Space') {
      event.preventDefault();
      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
    } else if (event.code === 'ArrowLeft') {
      event.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    } else if (event.code === 'ArrowRight') {
      event.preventDefault();
      audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${mins}:${secs}`;
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
    <Card
      className="snap-card"
      sx={{
        borderRadius: 3,
        display: 'flex',
        flexDirection: 'column',
        minHeight: { xs: '80vh', md: '72vh' },
        width: '100%',
        maxWidth: 880,
        mx: 'auto',
      }}
    >
      <CardContent
        className="snap-card-scroll"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          flexGrow: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          px: { xs: 3, md: 4 },
          py: { xs: 3, md: 4 },
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Stack spacing={0.5}>
            <Typography variant="h5">Rendered output</Typography>
            <Typography variant="body2" color="text.secondary">
              Download or sync with your workflow. Keyboard shortcuts are enabled while focused.
            </Typography>
          </Stack>
          <Chip
            label={voice}
            icon={<HeadphonesRoundedIcon sx={{ fontSize: 18 }} />}
            variant="outlined"
            sx={{ maxWidth: '100%' }}
          />
        </Stack>

        <Box
          sx={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: 3,
            border: '1px solid rgba(140,130,255,0.12)',
            p: 2.5,
          }}
        >
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            style={{ width: '100%' }}
          />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            sx={{ mt: 2 }}
          >
            <Typography variant="body2" color="text.secondary">
              Duration:&nbsp;<strong>{formatTime(duration || 0)}</strong>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Shortcuts: Space to play/pause, ←/→ seek ±5s
            </Typography>
          </Stack>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<DownloadRoundedIcon />}
            onClick={() => downloadAudio(audioBase64)}
            fullWidth
          >
            Download MP3
          </Button>
          {showSubtitles && (
            <Button
              variant="outlined"
              startIcon={<SubtitlesRoundedIcon />}
              onClick={() => downloadSubtitle(subtitleContent, subtitleFormat)}
              fullWidth
            >
              {`Download ${subtitleFormat.toUpperCase()}`}
            </Button>
          )}
          {showSubtitles && (
            <Button
              variant="contained"
              startIcon={<ArchiveRoundedIcon />}
              onClick={handleDownloadZip}
              fullWidth
            >
              Download ZIP
            </Button>
          )}
        </Stack>

        <Divider />

        {showSubtitles ? (
          <Stack spacing={2} flexGrow={1}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
            >
              <Typography variant="h6">Subtitles</Typography>
              <Chip label={subtitleFormat.toUpperCase()} variant="outlined" />
            </Stack>

            <Box
              tabIndex={0}
              onKeyDown={handleKeyDown}
              sx={{
                maxHeight: { xs: 280, md: 320 },
                overflowY: 'auto',
                borderRadius: 2.5,
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(140,130,255,0.08)',
                px: 2,
                py: 2,
                outline: 'none',
              }}
            >
              {cues.map((cue) => {
                const isActive = cue.id === activeCueId;
                return (
                  <Box
                    key={cue.id}
                    ref={isActive ? activeCueRef : null}
                    sx={{
                      mb: 1.5,
                      px: 1.5,
                      py: 1.25,
                      borderRadius: 2,
                      border: '1px solid transparent',
                      backgroundColor: isActive ? 'rgba(140,130,255,0.12)' : 'transparent',
                      borderColor: isActive ? 'rgba(140,130,255,0.32)' : 'transparent',
                      transition: 'background-color 0.2s ease, border-color 0.2s ease',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(cue.startTime / 1000)} → {formatTime(cue.endTime / 1000)}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {cue.text}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            <Typography variant="caption" color="text.secondary">
              Word-level highlighting will arrive when the worker exposes granular timestamps. For
              now, the active caption cue stays centered as audio plays.
            </Typography>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Subtitles were turned off for this render. Re-enable the option before generating audio
            to receive caption files.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
