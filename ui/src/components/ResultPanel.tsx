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
import { parseSubtitles, type SubtitleCue } from '../lib/subtitle';
import { downloadAudio, downloadSubtitle } from '../lib/workerClient';
import { downloadZip } from '../lib/zip';
import { createAudioURL } from '../lib/workerClient';
import { TranscriptPlayer } from './TranscriptPlayer';

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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

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
      setCurrentTime(audio.currentTime);
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
  }, []);

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
        width: { xs: '100%', md: 'min(100%, 960px)' },
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
              <Typography variant="h6">Interactive Transcript</Typography>
              <Chip label={subtitleFormat.toUpperCase()} variant="outlined" />
            </Stack>

            <Box tabIndex={0} onKeyDown={handleKeyDown} sx={{ outline: 'none' }}>
              <TranscriptPlayer audioRef={audioRef} cues={cues} currentTime={currentTime} />
            </Box>

            <Typography variant="caption" color="text.secondary">
              Click any word to jump to that moment in the audio. The currently spoken word is
              highlighted as playback progresses.
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
