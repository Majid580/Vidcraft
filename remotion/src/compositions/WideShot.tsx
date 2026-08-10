import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { themeFromStyleTokens } from '../theme';
import type { ShotCompositionProps } from '../types';

// Wide/establishing shot: slow "dolly-in" (scale) over the setting, caption
// fades in late so the environment reads first. Intended for shot.camera
// values like "wide, low-angle, slow dolly-in" (see proposal Section 6.3).
export const WideShot: React.FC<ShotCompositionProps> = ({ shot, worldState }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const theme = themeFromStyleTokens(worldState.style_tokens);

  const scale = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateRight: 'clamp',
  });
  const captionOpacity = interpolate(
    frame,
    [durationInFrames * 0.5, durationInFrames * 0.5 + 20],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          background: `radial-gradient(circle at 50% 70%, ${theme.accent}33, transparent 60%)`,
        }}
      />
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 72 }}>
        <div style={{ opacity: captionOpacity }}>
          <div
            style={{
              color: theme.accent,
              fontFamily: 'system-ui, sans-serif',
              fontSize: 22,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Wide — {shot.camera}
          </div>
          <div
            style={{
              color: theme.text,
              fontFamily: 'system-ui, sans-serif',
              fontSize: 40,
              maxWidth: 1400,
              marginTop: 8,
            }}
          >
            {worldState.setting}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
