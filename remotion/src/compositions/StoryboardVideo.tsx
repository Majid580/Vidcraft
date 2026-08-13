import React from 'react';
import { AbsoluteFill, Audio, Sequence, Series } from 'remotion';
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

// FR-10 (ADR-032): the voiceover track.
//
// Nothing here schedules the picture around the audio, and that is the whole
// point. Each beat's duration_s was MEASURED from its synthesised speech
// before this composition ever ran, and a shot's duration_s is the sum of its
// beats — so placing each clip at its beat's offset inside the shot lands it
// exactly where the timeline already expects it. Drift is not corrected here;
// it is structurally absent, because the timing came from the audio in the
// first place rather than being guessed at and hoped for.
//
// Silent beats simply contribute their length and no <Audio>.
// Beat offsets come from CUMULATIVE rounding inside the shot, never from
// rounding each beat's duration on its own — two 1.11s beats round to
// 33+33=66 frames while their 2.22s shot rounds to 67, and that one frame is
// enough to push a clip past the end of its <Series.Sequence> or to disagree
// with the caption track, which derives its boundaries the same way in
// ffmpegService.buildVtt. Both must round identically or the voice and the
// subtitles describe different moments.
const BeatAudio: React.FC<{ shot: Shot }> = ({ shot }) => {
  if (!shot.beats?.length) return null;

  const shotFrames = framesFor(shot);
  let elapsed = 0;
  let previous = 0;

  return (
    <>
      {shot.beats.map((beat) => {
        const from = previous;
        elapsed += beat.duration_s;
        previous = Math.min(shotFrames, Math.round(elapsed * FPS));
        if (!beat.narrationSrc || previous <= from) return null;
        return (
          <Sequence key={beat.beat_id} from={from} durationInFrames={previous - from}>
            <Audio src={beat.narrationSrc} />
          </Sequence>
        );
      })}
    </>
  );
};

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
              <BeatAudio shot={shot} />
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
