import React from 'react';
import { Composition } from 'remotion';
import { TitleCard } from './TitleCard';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TitleCard"
      component={TitleCard}
      durationInFrames={90}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        title: 'VidCraft',
        subtitle: 'Remotion pathway — REMOTION-001 test composition',
      }}
    />
  );
};
