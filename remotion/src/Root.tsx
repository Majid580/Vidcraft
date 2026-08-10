import React from 'react';
import { Composition } from 'remotion';
import { TitleCard } from './TitleCard';
import { WideShot } from './compositions/WideShot';
import { MediumShot } from './compositions/MediumShot';
import { CloseUpShot } from './compositions/CloseUpShot';
import type { Shot, ShotCompositionProps, WorldState } from './types';

const FPS = 30;

// Sample storyboard, adapted from the worked example in
// VidCraft_Proposal.tex Section 6.3 ("an astronaut repairs a broken
// antenna on Mars before nightfall"). Used only as defaultProps for local
// preview/render — the real values will come from FR-3's orchestrator
// output once AI-004/005 exist.
const sampleWorldState: WorldState = {
  characters: ['astronaut in a worn white EVA suit, reflective visor'],
  setting: 'rust-red Martian plain, distant low hills',
  style_tokens: ['cinematic', 'warm dusk lighting'],
};

const sampleShots: Record<'wide' | 'medium' | 'closeup', Shot> = {
  wide: {
    shot_id: 1,
    description:
      'Wide shot: astronaut walks toward a damaged antenna tower as the sun begins to set.',
    camera: 'wide, low-angle, slow dolly-in',
    duration_s: 4,
    pathway: 'remotion',
  },
  medium: {
    shot_id: 2,
    description: "Astronaut approaches the antenna tower, assessing the damage.",
    camera: 'medium, static',
    duration_s: 3,
    pathway: 'remotion',
  },
  closeup: {
    shot_id: 3,
    description: "Close shot: astronaut's gloved hands adjusting a control panel.",
    camera: 'close-up, static',
    duration_s: 3,
    pathway: 'remotion',
  },
};

// Dynamic duration per FR-5: shot.duration_s (from the real storyboard),
// not a hardcoded composition length — each shot in a storyboard can run a
// different length, and the composition must honor that.
const calculateShotMetadata = ({ props }: { props: ShotCompositionProps }) => ({
  durationInFrames: Math.round(props.shot.duration_s * FPS),
  fps: FPS,
  width: 1920,
  height: 1080,
});

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TitleCard"
        component={TitleCard}
        durationInFrames={90}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'VidCraft',
          subtitle: 'Remotion pathway — REMOTION-001 test composition',
        }}
      />
      <Composition
        id="WideShot"
        component={WideShot}
        durationInFrames={sampleShots.wide.duration_s * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ shot: sampleShots.wide, worldState: sampleWorldState }}
        calculateMetadata={calculateShotMetadata}
      />
      <Composition
        id="MediumShot"
        component={MediumShot}
        durationInFrames={sampleShots.medium.duration_s * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ shot: sampleShots.medium, worldState: sampleWorldState }}
        calculateMetadata={calculateShotMetadata}
      />
      <Composition
        id="CloseUpShot"
        component={CloseUpShot}
        durationInFrames={sampleShots.closeup.duration_s * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ shot: sampleShots.closeup, worldState: sampleWorldState }}
        calculateMetadata={calculateShotMetadata}
      />
    </>
  );
};
