import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ShotLayer } from '../components/ShotLayer';
import { themeFromStyleTokens } from '../theme';
import type { ShotCompositionProps } from '../types';

// Medium/character shot. Intended for shot.camera values like "medium,
// static" or "medium, handheld" — character-focused rather than
// environment-focused (contrast with WideShot).
//
// With a generated still: a gentle push with a slow lateral drift, the
// closest still-image analogue of a handheld medium. Without one: the
// original framed "portrait" card, entering with a spring bounce.
export const MediumShot: React.FC<ShotCompositionProps> = ({ shot, worldState }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = themeFromStyleTokens(worldState.style_tokens);

  const entrance = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });
  const subject = worldState.characters[0] ?? 'Unnamed subject';

  if (shot.imageSrc) {
    const scale = interpolate(frame, [0, durationInFrames], [1.06, 1.12], {
      extrapolateRight: 'clamp',
    });
    // Starts already slightly in, so the drift never exposes an edge.
    const driftX = interpolate(frame, [0, durationInFrames], [-1.2, 1.2], {
      extrapolateRight: 'clamp',
    });
    return (
      <ShotLayer
        imageSrc={shot.imageSrc}
        theme={theme}
        transform={`scale(${scale}) translateX(${driftX}%)`}
      />
    );
  }

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
