import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { themeFromStyleTokens } from '../theme';
import type { ShotCompositionProps } from '../types';

// Close-up/detail shot: tight vignette that punches in fast, for a single
// detail beat (e.g. "close-up, static" on hands/an object). Deliberately
// the most kinetic of the three — close-ups read as urgent/intimate.
export const CloseUpShot: React.FC<ShotCompositionProps> = ({ shot, worldState }) => {
  const frame = useCurrentFrame();
  const theme = themeFromStyleTokens(worldState.style_tokens);

  const punchIn = interpolate(frame, [0, 12], [1.3, 1], {
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, ${theme.accent}22 0%, ${theme.background} 75%)`,
        }}
      />
      <AbsoluteFill
        style={{
          transform: `scale(${punchIn})`,
          opacity,
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            border: `3px solid ${theme.accent}`,
            borderRadius: '50%',
            width: 560,
            height: 560,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: 48,
          }}
        >
          <div>
            <div
              style={{
                color: theme.accent,
                fontSize: 18,
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Close-up — {shot.camera}
            </div>
            <div style={{ color: theme.text, fontSize: 28, lineHeight: 1.4 }}>
              {shot.description}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
