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
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Scroll active line to center
  useEffect(() => {
    if (activeCueRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeElement = activeCueRef.current;
      
      const containerHeight = container.clientHeight;
      const elementTop = activeElement.offsetTop;
      const elementHeight = activeElement.offsetHeight;
      
      // Calculate scroll position to center the active line
      const scrollPosition = elementTop - (containerHeight / 2) + (elementHeight / 2);
      
      container.scrollTo({
        top: scrollPosition,
        behavior: 'smooth',
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
      ref={containerRef}
      sx={{
        maxHeight: { xs: 360, md: 420 },
        overflowY: 'auto',
        borderRadius: 2.5,
        backgroundColor: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.05)',
        px: { xs: 3, md: 4 },
        py: { xs: 3, md: 4 },
        scrollBehavior: 'smooth',
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
              mb: 2.5,
              cursor: 'pointer',
              transition: 'opacity 0.2s ease',
              '&:hover': {
                opacity: 1,
              },
            }}
          >
            <Box 
              sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 0.75,
                lineHeight: 2,
                fontFamily: '"Atkinson Hyperlegible", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: { xs: '1.125rem', md: '1.25rem' },
                letterSpacing: '0.01em',
              }}
            >
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
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      letterSpacing: 'inherit',
                      fontWeight: 400,
                      color: isActiveWord ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                      backgroundColor: isActiveWord
                        ? 'rgba(255,255,255,0.03)'
                        : 'transparent',
                      px: isActiveWord ? 0.5 : 0,
                      py: isActiveWord ? 0.25 : 0,
                      borderRadius: 0.5,
                      cursor: 'pointer',
                      transition: 'color 0.2s ease, background-color 0.2s ease',
                      '&:hover': {
                        color: 'rgba(255,255,255,0.8)',
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
