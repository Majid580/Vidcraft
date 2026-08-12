const { execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// remotion/ is a sibling top-level directory, not a dependency of this
// package (per ADR-009 in PROJECT_ARCHITECTURE.md) — invoked as a child
// process, the same way FFmpeg will be (Section 6.5/6.8).
const REMOTION_DIR = path.join(__dirname, '..', '..', '..', 'remotion');
const RENDER_SCRIPT = 'render-shot.mjs';
const STORYBOARD_RENDER_SCRIPT = 'render-storyboard.mjs';

// Where the headless browser can reach this server's /media mount to load
// each shot's generated still. Same process serves the API and the queue in
// this setup, so localhost is correct; override if the worker is ever split
// onto its own host.
const MEDIA_BASE_URL =
  process.env.MEDIA_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

/**
 * Runs one of the remotion/*.mjs render entry points as a child process.
 *
 * Shot/worldState text is untrusted (same as any user-derived prompt
 * content, per FR-1's security note) so it is written to a temp JSON file
 * and passed by path — never interpolated into a shell command string.
 * execFile + an argv array + shell:false means no shell ever parses this
 * content, regardless of what characters it contains.
 */
function runRenderScript(script, props, outputPath, timeout) {
  return new Promise((resolve, reject) => {
    const tmpPropsPath = path.join(
      os.tmpdir(),
      `vidcraft-${path.basename(script, '.mjs')}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
    );
    fs.writeFileSync(tmpPropsPath, JSON.stringify(props));

    execFile(
      'node',
      [script, tmpPropsPath, outputPath],
      { cwd: REMOTION_DIR, shell: false, timeout },
      (error, stdout, stderr) => {
        fs.rmSync(tmpPropsPath, { force: true });

        if (error) {
          reject(new Error(`Remotion render failed: ${stderr || error.message}`));
          return;
        }

        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          resolve({ compositionId: undefined, outputPath });
        }
      },
    );
  });
}

/**
 * Renders a single shot via the Remotion pathway (FR-5). The actual
 * shot -> composition selection (REMOTION-003) lives in
 * remotion/render-shot.mjs, next to the compositions it selects between —
 * this function is a thin, safe process-invocation wrapper, not a second
 * copy of that decision.
 *
 * Shot/worldState text is untrusted (same as any user-derived prompt
 * content, per FR-1's security note) so it is written to a temp JSON file
 * and passed by path — never interpolated into a shell command string.
 * execFile + an argv array + shell:false means no shell ever parses this
 * content, regardless of what characters it contains.
 *
 * @param {object} shot
 * @param {object} worldState
 * @param {string} outputPath absolute or REMOTION_DIR-relative output path
 * @returns {Promise<{ compositionId: string, outputPath: string }>}
 */
function renderShot(shot, worldState, outputPath) {
  return runRenderScript(RENDER_SCRIPT, { shot, worldState }, outputPath, 120_000);
}

/**
 * Which of a storyboard's shots actually make it into the assembled video,
 * in timeline order: those that produced an asset. Shots without an
 * asset_url (failed, on-hold, or never generated) are dropped rather than
 * rendered as gaps — a partial storyboard should still yield a watchable
 * video of the shots that did succeed.
 *
 * Exported because the FR-9 subtitle track (ffmpegService) has to describe
 * exactly the shots that ended up on the timeline, at exactly their
 * offsets. Two independent copies of this filter would silently desync
 * captions from picture the first time a single shot failed.
 */
function assembledShots(shots) {
  return shots.filter((shot) => Boolean(shot.asset_url));
}

/**
 * FR-9 — concatenates a storyboard's generated stills into one continuous
 * MP4 (remotion/src/compositions/StoryboardVideo.tsx). Each shot is held for
 * its own duration_s and gets the camera movement its framing implies, so
 * the result is a sequence of moving shots rather than a slideshow.
 *
 * Only assembledShots() are rendered; throws if that leaves nothing.
 *
 * @param {object[]} shots  storyboard shots, each with asset_url
 * @param {object} worldState
 * @param {string} outputPath
 */
function renderStoryboard(shots, worldState, outputPath) {
  const renderable = assembledShots(shots)
    .map((shot) => {
      // Only image assets become an <Img> layer. A remotion-pathway shot's
      // asset_url is already an .mp4 of that shot, which <Img> cannot
      // display — those re-render from world_state as motion-graphics cards
      // (imageSrc omitted), which is exactly what that pathway produces on
      // its own. So a mixed or all-Remotion storyboard still assembles.
      const isImage = /\.(jpe?g|png|webp)$/i.test(shot.asset_url);
      return {
        shot_id: shot.shot_id,
        description: shot.description,
        camera: shot.camera,
        duration_s: shot.duration_s,
        pathway: shot.pathway,
        // Remotion's headless browser needs an absolute URL; asset_url is
        // stored as a server-relative /media path.
        ...(isImage ? { imageSrc: `${MEDIA_BASE_URL}${shot.asset_url}` } : {}),
      };
    });

  if (renderable.length === 0) {
    return Promise.reject(new Error('No generated shots available to assemble into a video'));
  }

  // Scales with shot count — a five-shot 1080p render is meaningfully longer
  // than the single-shot case the 120s budget was sized for.
  const timeout = Math.min(600_000, 120_000 + renderable.length * 90_000);

  return runRenderScript(
    STORYBOARD_RENDER_SCRIPT,
    { shots: renderable, worldState },
    outputPath,
    timeout,
  );
}

module.exports = { renderShot, renderStoryboard, assembledShots, MEDIA_BASE_URL };
