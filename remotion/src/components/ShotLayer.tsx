import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import type { Theme } from '../theme';

// The shared visual body of every shot composition (FR-5 + FR-9).
//
// Remotion cannot invent imagery — it composites what it is given. When a
// shot has a generated still (`imageSrc`), that image is the shot, and the
// composition's only job is to move the camera across it: a still plus
// continuous motion reads as a filmed shot, which is how a storyboard of
// stills becomes a video without any video model. When there is no still
// (a pure-Remotion storyboard), callers render their own motion-graphics
// fallback instead.
//
// Two continuity devices are applied on top of the image, both driven by the
// storyboard-wide theme derived from world_state.style_tokens — so even when
// the provider's stills drift in tone between shots, the finished sequence
// still grades to one consistent look (FR-7, made visible on screen):
//   - a low-opacity accent wash
//   - a vignette that matches the theme's background
//
// `transform` is supplied per shot type (dolly-in, push, punch-in) by the
// composition that owns the shot — this component deliberately holds no
// opinion about which movement a given framing deserves.

export type ShotLayerProps = {
  imageSrc: string;
  theme: Theme;
  transform: string;
  // Frames of fade-up at the head of the shot. Softens each cut inside a
  // <Series> so shots join as a sequence rather than a slideshow.
  fadeInFrames?: number;
};

export const ShotLayer: React.FC<ShotLayerProps> = ({
  imageSrc,
  theme,
  transform,
  fadeInFrames = 8,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, fadeInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background, overflow: 'hidden', opacity }}>
      <AbsoluteFill style={{ transform }}>
        <Img
          src={imageSrc}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </AbsoluteFill>

      {/* Palette unification — see note above. */}
      <AbsoluteFill
        style={{ backgroundColor: theme.accent, opacity: 0.08, mixBlendMode: 'overlay' }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 50%, transparent 55%, ${theme.background}cc 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
