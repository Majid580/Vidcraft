import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export type TitleCardProps = {
  title: string;
  subtitle: string;
};

export const TitleCard: React.FC<TitleCardProps> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0b0b12',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ opacity, transform: `scale(${scale})`, textAlign: 'center' }}>
        <div style={{ color: '#fff', fontSize: 90, fontWeight: 700 }}>{title}</div>
        <div style={{ color: '#a1a1aa', fontSize: 32, marginTop: 16 }}>{subtitle}</div>
      </div>
    </AbsoluteFill>
  );
};
