import { useEffect, useRef, useState } from 'react';
import { Box, Card, Typography } from '@mui/material';
import { approximateWordTimings, type SubtitleCue, type WordTiming } from '../lib/subtitle';

interface TranscriptPlayerProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  cues: SubtitleCue[];
  currentTime: number;
}

export function TranscriptPlayer({ audioRef, cues, currentTime }: TranscriptPlayerProps) {
  const [activeWordIndices, setActiveWordIndices] = useState<Map<string, number>>(new Map());
  const activeCueRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  // Find active cue and active word within that cue
  useEffect(() => {
    const timeMs = currentTime * 1000;
    const newActiveWordIndices = new Map<string, number>();

    cues.forEach((cue) => {
      if (timeMs >= cue.startTime && timeMs <= cue.endTime) {
        const wordTimings = approximateWordTimings(cue);
        const activeWordIndex = wordTimings.findIndex(
          (wt) => timeMs >= wt.startTime && timeMs <= wt.endTime
        );
        if (activeWordIndex !== -1) {
          newActiveWordIndices.set(cue.id, activeWordIndex);
        }
      }
    });

    setActiveWordIndices(newActiveWordIndices);
  }, [currentTime, cues]);

  // Scroll active word into view
  useEffect(() => {
    if (activeWordRef.current) {
      activeWordRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeWordIndices]);

  const handleWordClick = (wordTiming: WordTiming) => {
    if (audioRef.current) {
      audioRef.current.currentTime = wordTiming.startTime / 1000;
    }
  };

  const handleCueClick = (cue: SubtitleCue) => {
    if (audioRef.current) {
      audioRef.current.currentTime = cue.startTime / 1000;
    }
  };

  if (cues.length === 0) {
    return (
      <Card
        sx={{
          borderRadius: 2.5,
          backgroundColor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(140,130,255,0.08)',
          px: 3,
          py: 4,
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No transcript available
        </Typography>
      </Card>
    );
  }

  return (
    <Box
      sx={{
        maxHeight: { xs: 360, md: 420 },
        overflowY: 'auto',
        borderRadius: 2.5,
        backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(140,130,255,0.08)',
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      {cues.map((cue) => {
        const wordTimings = approximateWordTimings(cue);
        const activeWordIndex = activeWordIndices.get(cue.id);
        const isCueActive = activeWordIndex !== undefined;

        return (
          <Box
            key={cue.id}
            ref={isCueActive ? activeCueRef : null}
            onClick={() => handleCueClick(cue)}
            sx={{
              mb: 2,
              px: 2,
              py: 1.5,
              borderRadius: 2,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: 'rgba(140,130,255,0.06)',
              },
            }}
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, lineHeight: 1.8 }}>
              {wordTimings.map((wordTiming, index) => {
                const isActiveWord = isCueActive && index === activeWordIndex;
                return (
                  <Typography
                    key={index}
                    component="span"
                    ref={isActiveWord ? activeWordRef : null}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWordClick(wordTiming);
                    }}
                    sx={{
                      fontSize: { xs: '0.95rem', md: '1.05rem' },
                      fontWeight: isActiveWord ? 600 : 400,
                      color: isActiveWord ? 'primary.main' : 'text.primary',
                      backgroundColor: isActiveWord
                        ? 'rgba(140,130,255,0.2)'
                        : 'transparent',
                      px: isActiveWord ? 0.75 : 0,
                      py: isActiveWord ? 0.25 : 0,
                      borderRadius: 1,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        color: 'primary.light',
                        backgroundColor: 'rgba(140,130,255,0.12)',
                      },
                    }}
                  >
                    {wordTiming.word}
                  </Typography>
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
