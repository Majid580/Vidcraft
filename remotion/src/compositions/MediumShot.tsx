import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { themeFromStyleTokens } from '../theme';
import type { ShotCompositionProps } from '../types';

// Medium/character shot: a framed "portrait" card for the subject, entering
// with a spring bounce. Intended for shot.camera values like "medium,
// static" or "medium, handheld" — character-focused rather than
// environment-focused (contrast with WideShot).
export const MediumShot: React.FC<ShotCompositionProps> = ({ shot, worldState }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = themeFromStyleTokens(worldState.style_tokens);

  const entrance = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });
  const subject = worldState.characters[0] ?? 'Unnamed subject';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.background,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          transform: `translateY(${(1 - entrance) * 60}px)`,
          opacity: entrance,
          width: 900,
          border: `2px solid ${theme.accent}`,
          borderRadius: 16,
          padding: 48,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            color: theme.accent,
            fontSize: 20,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          Medium — {shot.camera}
        </div>
        <div style={{ color: theme.text, fontSize: 34, lineHeight: 1.4 }}>{subject}</div>
        <div style={{ color: '#9ca3af', fontSize: 22, marginTop: 20 }}>
          {shot.description}
        </div>
      </div>
    </AbsoluteFill>
  );
};
