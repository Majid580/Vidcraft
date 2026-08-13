const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const { assembledShots } = require('./remotionService');

const execFileAsync = promisify(execFile);

// INTEG-002 — the FFmpeg half of FR-9's post-processing pipeline.
//
// Concatenation, colour grading and H.264 compression deliberately do NOT
// live here: ADR-027 moved them into Remotion's StoryboardVideo composition,
// because an FFmpeg concat of stills yields a slideshow whereas every
// Remotion-assembled shot is already a moving shot. What was left over is
// what this module does — the two steps that operate ON a finished video
// rather than producing it: a poster/thumbnail frame, and a subtitle track.
//
// Every step here is strictly additive. The assembled master
// (storyboard.mp4) is never modified or replaced: the hardsubbed copy is a
// separate file, so the clean master stays available for download and for
// the evaluation study, where burned-in text would corrupt any frame-level
// image metric (FR-12/EVAL-004 territory).

// Mirrors FPS in remotion/src/compositions/StoryboardVideo.tsx and the
// composition metadata in remotion/src/Root.tsx. Subtitle cue boundaries
// must land on the same frames the renderer used, so this is the same
// number by necessity, not by coincidence — postProcess() cross-checks the
// total it derives against the frame count the renderer actually reported
// and refuses to write desynced captions if they disagree.
const STORYBOARD_FPS = 30;

// Same rule as StoryboardVideo.tsx's framesFor(): round to the nearest
// frame, never zero-length.
const framesFor = (shot) => Math.max(1, Math.round(shot.duration_s * STORYBOARD_FPS));

// Conventional subtitle legibility limits: at most two lines, ~42 characters
// each, so a cue never becomes a wall of text over the picture.
const MAX_LINE_CHARS = 42;
const MAX_LINES = 2;

const THUMBNAIL_FILENAME = 'thumbnail.jpg';
const SUBTITLES_FILENAME = 'storyboard.vtt';
const SUBTITLED_VIDEO_FILENAME = 'storyboard-subtitled.mp4';

/** frames -> a WebVTT timestamp (HH:MM:SS.mmm). */
function timestamp(frames) {
  const totalMs = Math.round((frames / STORYBOARD_FPS) * 1000);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n, width = 2) => String(n).padStart(width, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

/**
 * Wraps a shot description into at most MAX_LINES lines of MAX_LINE_CHARS,
 * breaking on word boundaries and eliding the remainder. Shot descriptions
 * are a sentence or two of prose written for an image model, not for a
 * viewer reading at 24fps, so some of them genuinely do overflow.
 */
function wrapCue(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= MAX_LINE_CHARS) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (lines.length === MAX_LINES) {
      // Out of room — mark the elision on the last line we kept.
      lines[MAX_LINES - 1] = `${lines[MAX_LINES - 1].replace(/[\s.,;:]+$/, '')}…`;
      return lines.join('\n');
    }
    // A single word longer than a whole line (a URL, a long compound) —
    // hard-cut it rather than emitting an over-long line.
    line = word.length > MAX_LINE_CHARS ? `${word.slice(0, MAX_LINE_CHARS - 1)}…` : word;
  }

  if (line) lines.push(line);
  return lines.join('\n');
}

/**
 * Builds the WebVTT caption track for an assembled storyboard: one cue per
 * shot, running for exactly that shot's slice of the timeline.
 *
 * WebVTT rather than SRT deliberately — it is the only subtitle format an
 * HTML5 <video><track> element can display, so the same single file serves
 * both the in-browser player and libass when burning the hardsubbed copy
 * below. Emitting SRT would have meant maintaining two near-identical
 * files that can disagree.
 *
 * @param {object[]} shots the storyboard's shots (filtered here, so callers
 *   pass the same array they passed to renderStoryboard)
 * @returns {{ vtt: string, totalFrames: number, cueCount: number }}
 */
function buildVtt(shots) {
  const included = assembledShots(shots);
  const cues = [];
  let cursor = 0;

  included.forEach((shot) => {
    // FR-10 (ADR-032) — when a shot has been narrated, its beats ARE the
    // timeline, so captions follow them: one cue per beat, carrying the line
    // actually spoken over it. Captions that said something other than the
    // voiceover would be worse than none, and beat boundaries are already
    // the measured truth here.
    //
    // Crucially this still walks the SAME cursor in the same frame units, so
    // the total the desync guard checks is unchanged — a shot's beats sum to
    // its duration_s by construction (narrationService set it that way).
    const beats = Array.isArray(shot.beats) && shot.beats.length ? shot.beats : null;
    const shotStart = cursor;
    const shotFrames = framesFor(shot);
    cursor += shotFrames;

    if (beats) {
      // Beat boundaries are derived by CUMULATIVE rounding inside the shot,
      // never by rounding each beat's duration on its own. Rounding
      // independently lets a shot's beats sum to a frame more or less than
      // the shot itself — e.g. two 1.11s beats round to 33+33=66 frames
      // while their 2.22s shot rounds to 67 — which would desynchronise the
      // captions from the picture and, worse, corrupt the frame total the
      // guard below checks against Remotion's actual render. Deriving each
      // boundary from the running total, and clamping the last to the shot's
      // own frame count, makes the beats sum to the shot exactly.
      let elapsed = 0;
      let previous = 0;
      beats.forEach((beat) => {
        elapsed += beat.duration_s;
        const offset = Math.min(shotFrames, Math.round(elapsed * STORYBOARD_FPS));
        const start = shotStart + previous;
        const end = shotStart + offset;
        previous = offset;
        // A deliberately silent beat gets no cue but still consumes its
        // time, so everything after it stays aligned.
        const text = wrapCue(beat.narration || '');
        if (!text || end <= start) return;
        cues.push(`${cues.length + 1}\n${timestamp(start)} --> ${timestamp(end)}\n${text}`);
      });
      return;
    }

    const text = wrapCue(shot.description);
    if (!text) return;
    cues.push(`${cues.length + 1}\n${timestamp(shotStart)} --> ${timestamp(cursor)}\n${text}`);
  });

  return {
    vtt: `WEBVTT\n\n${cues.join('\n\n')}\n`,
    totalFrames: cursor,
    cueCount: cues.length,
  };
}

/**
 * Extracts the poster frame. Sampled from the midpoint of the FIRST
 * assembled shot rather than of the whole video: shot one is the
 * establishing shot, and its midpoint is past the camera move's opening
 * frames (where a dolly-in is still at its widest and least composed) while
 * still being unambiguously the subject the storyboard opens on. A midpoint
 * of the whole timeline would land on an arbitrary later shot — often a
 * close-up of a detail, which makes a poor thumbnail.
 */
async function extractThumbnail(videoPath, shots, outputPath) {
  const first = assembledShots(shots)[0];
  const seekSeconds = first ? Math.max(0, (framesFor(first) / STORYBOARD_FPS) / 2) : 0;

  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      // Fast (pre-input) seek. Accurate enough here — every shot is a hold
      // of several seconds, so landing a frame or two off is invisible.
      '-ss', seekSeconds.toFixed(3),
      '-i', videoPath,
      '-frames:v', '1',
      // 640px wide, height rounded to an even number to stay encoder-safe
      // for any downstream use.
      '-vf', 'scale=640:-2',
      '-q:v', '3',
      outputPath,
    ],
    { shell: false, timeout: 60_000 },
  );

  return outputPath;
}

/**
 * Burns the caption track into a copy of the video (libass via FFmpeg's
 * `subtitles` filter — this build is compiled --enable-libass).
 *
 * The filter is run with cwd set to the media directory and the subtitle
 * file referenced by bare basename. That is not a stylistic choice: FFmpeg's
 * filtergraph parser treats `:` and `\` as syntax, so a Windows absolute
 * path (C:\...\storyboard.vtt) has to be escaped through two levels of
 * quoting to survive it. Passing a constant basename from a known cwd
 * sidesteps the escaping entirely.
 */
async function burnSubtitles(videoPath, mediaDir, outputPath) {
  const style = [
    'FontName=Arial',
    'FontSize=20',
    'PrimaryColour=&H00FFFFFF',
    'BorderStyle=3', // opaque box behind the text — readable over any frame
    'Outline=1',
    'Shadow=0',
    'MarginV=48',
  ].join(',');

  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i', videoPath,
      '-vf', `subtitles=${SUBTITLES_FILENAME}:force_style='${style}'`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      // The assembled video has no audio track yet (FR-10 narration is a
      // stretch goal); -an keeps that explicit rather than incidental.
      '-an',
      '-movflags', '+faststart',
      outputPath,
    ],
    { cwd: mediaDir, shell: false, timeout: 300_000 },
  );

  return outputPath;
}

/**
 * FR-9 post-processing for one finished storyboard video: poster frame,
 * WebVTT caption track, and a hardsubbed copy.
 *
 * Best-effort per artifact, and non-fatal by design — the assembled video
 * and the per-shot assets are the expensive, quota-consuming parts of a run
 * and are already on disk by the time this is called. A missing thumbnail
 * must not discard them. Whatever succeeds is returned; whatever fails is
 * summarised in `error` for the caller to persist.
 *
 * @param {object} params
 * @param {string} params.videoPath  the assembled master (never modified)
 * @param {string} params.mediaDir   directory that /media serves it from
 * @param {string} params.mediaUrlBase e.g. `/media/<storyboardId>`
 * @param {object[]} params.shots
 * @param {number} [params.renderedDurationInFrames] frame count the renderer
 *   reported, used to catch caption/picture desync
 */
async function postProcess({
  videoPath,
  mediaDir,
  mediaUrlBase,
  shots,
  renderedDurationInFrames,
}) {
  const result = {
    thumbnail_url: undefined,
    subtitles_url: undefined,
    subtitled_video_url: undefined,
    error: undefined,
  };
  const failures = [];

  try {
    await extractThumbnail(videoPath, shots, path.join(mediaDir, THUMBNAIL_FILENAME));
    result.thumbnail_url = `${mediaUrlBase}/${THUMBNAIL_FILENAME}`;
  } catch (err) {
    failures.push(`thumbnail: ${err.message}`);
  }

  try {
    const { vtt, totalFrames, cueCount } = buildVtt(shots);
    if (cueCount === 0) throw new Error('no shots with descriptions to caption');

    // If our frame arithmetic disagrees with what Remotion actually
    // rendered, the cues would drift against the picture. Writing them
    // anyway would be worse than writing none: silently-wrong captions look
    // correct until someone watches to the end.
    if (
      typeof renderedDurationInFrames === 'number' &&
      renderedDurationInFrames !== totalFrames
    ) {
      throw new Error(
        `timeline mismatch — captions computed ${totalFrames} frames but the ` +
          `render reported ${renderedDurationInFrames}; refusing to write ` +
          'captions that would drift out of sync',
      );
    }

    fs.writeFileSync(path.join(mediaDir, SUBTITLES_FILENAME), vtt, 'utf-8');
    result.subtitles_url = `${mediaUrlBase}/${SUBTITLES_FILENAME}`;

    try {
      await burnSubtitles(
        videoPath,
        mediaDir,
        path.join(mediaDir, SUBTITLED_VIDEO_FILENAME),
      );
      result.subtitled_video_url = `${mediaUrlBase}/${SUBTITLED_VIDEO_FILENAME}`;
    } catch (err) {
      // A usable .vtt with no hardsub is still a complete captioning story
      // for the web player, so this failure is reported without discarding
      // the track above it.
      failures.push(`subtitle burn-in: ${err.message}`);
    }
  } catch (err) {
    failures.push(`subtitles: ${err.message}`);
  }

  if (failures.length) result.error = failures.join('; ');
  return result;
}

module.exports = {
  postProcess,
  buildVtt,
  wrapCue,
  extractThumbnail,
  burnSubtitles,
  STORYBOARD_FPS,
  THUMBNAIL_FILENAME,
  SUBTITLES_FILENAME,
  SUBTITLED_VIDEO_FILENAME,
};
