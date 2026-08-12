import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import { WideShot } from './WideShot';
import { MediumShot } from './MediumShot';
import { CloseUpShot } from './CloseUpShot';
import { selectCompositionId } from '../shotTaxonomy.mjs';
import type { Shot, StoryboardCompositionProps } from '../types';

const FPS = 30;

// FR-9 (post-processing / concatenation), done in Remotion rather than with
// an FFmpeg concat pass.
//
// The storyboard's shots were already being generated one still at a time and
// then left as loose files that nothing ever joined — so the pipeline had no
// final deliverable. <Series> stitches them into one continuous timeline,
// each shot held for its own duration_s (the value the Screenwriter chose,
// carried all the way through), with the same per-shot-type camera movement
// the individual compositions already implement.
//
// Doing this in Remotion instead of FFmpeg buys the motion for free: an
// FFmpeg concat of stills yields a slideshow, whereas each shot here is
// already a moving shot. It also keeps one renderer in the stack instead of
// two, and the shot->composition taxonomy stays the single source of truth
// for how a framing is interpreted.

const COMPONENTS = {
  WideShot,
  MediumShot,
  CloseUpShot,
} as const;

const framesFor = (shot: Shot) => Math.max(1, Math.round(shot.duration_s * FPS));

export const StoryboardVideo: React.FC<StoryboardCompositionProps> = ({
  shots,
  worldState,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Series>
        {shots.map((shot) => {
          const Component = COMPONENTS[selectCompositionId(shot) as keyof typeof COMPONENTS];
          return (
            <Series.Sequence
              key={shot.shot_id}
              durationInFrames={framesFor(shot)}
            >
              <Component shot={shot} worldState={worldState} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};

// Total timeline length, used by the composition's calculateMetadata so the
// render is exactly as long as the storyboard says it should be.
export const totalDurationInFrames = (shots: Shot[]) =>
  Math.max(1, shots.reduce((sum, shot) => sum + framesFor(shot), 0));
