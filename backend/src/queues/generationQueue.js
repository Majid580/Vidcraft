const path = require('node:path');
const Queue = require('bull');

const Storyboard = require('../models/Storyboard');
const generationService = require('../services/generationService');
const remotionService = require('../services/remotionService');
const ffmpegService = require('../services/ffmpegService');
const criticService = require('../services/criticService');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// The generation queue (BACKEND-003 scaffold, wired for real in INTEG-001).
// Runs in-process with the API server for this single-process dev/demo setup;
// a production deployment would run this processor in a separate worker.
const generationQueue = new Queue('generation', REDIS_URL);

/**
 * INTEG-001 — the real "generation" job (one per storyboard). Enqueued by
 * POST /api/storyboards/:id/generate. Processes every shot in order via
 * generationService (Remotion render or external-API generation), persisting
 * each shot's status/asset_url/error to Mongo as it goes — so GET
 * /api/storyboards/:id and GET /api/jobs/:id reflect live progress — and
 * reporting job.progress() as a 0-100 percentage.
 *
 * A per-shot failure (or a deliberately-held huggingface video shot) is
 * recorded on that shot (status 'failed' / 'on_hold') and the job keeps
 * going: one bad provider call must not fail the whole batch, matching the
 * previous synchronous route's behaviour. The job itself only rejects on an
 * infrastructure error (e.g. the storyboard vanished), which Bull records as
 * a failed job with a failedReason for GET /api/jobs/:id to surface.
 */
async function processGeneration(job) {
  const { storyboardId } = job.data;
  const doc = await Storyboard.findById(storyboardId);
  if (!doc) throw new Error(`Storyboard ${storyboardId} not found`);

  const total = doc.shots.length || 1;
  let done = 0;
  const summary = [];

  for (const shot of doc.shots) {
    shot.status = 'processing';
    doc.markModified('shots');
    await doc.save();

    try {
      shot.asset_url = await generationService.generateShotAsset(
        doc.id,
        shot,
        doc.world_state,
      );
      shot.status = 'completed';
      shot.error = undefined;

      // FR-7: the first frame this storyboard successfully generates becomes
      // its visual anchor — every later shot is conditioned on it (img2img,
      // where the provider supports it) so the subject and environment carry
      // across the sequence instead of being re-invented per shot. Written
      // once and then left alone: re-anchoring mid-run to a later shot would
      // let the look drift shot by shot, which is the exact failure this is
      // here to prevent. Remotion shots render deterministically from
      // world_state and need no anchor, so they never claim the slot.
      if (shot.pathway !== 'remotion' && !doc.world_state.reference_image_url) {
        doc.world_state.reference_image_url = shot.asset_url;
        doc.markModified('world_state');
      }

      // CRITIC-001 (FR-8): vision-model quality gate + bounded retry loop.
      // A critic-loop failure (ai-service unreachable, ffmpeg missing, …) is
      // an infrastructure hiccup, not evidence the generation itself was
      // bad — the shot stays 'completed' with its last known-good asset,
      // just unverified, rather than dragging a successful render down to
      // 'failed'.
      try {
        await criticService.runCriticLoop(doc.id, shot, doc.world_state);
      } catch (criticErr) {
        shot.critic_reason = `critic evaluation unavailable: ${criticErr.message}`;
      }
    } catch (err) {
      shot.status = err.onHold ? 'on_hold' : 'failed';
      shot.error = err.message;
    }

    done += 1;
    doc.markModified('shots');
    await doc.save();
    await job.progress(Math.round((done / total) * 100));
    summary.push({ shot_id: shot.shot_id, status: shot.status });
  }

  // FR-9 — assemble the finished video from whatever generated successfully.
  // Deliberately last, and deliberately non-fatal: the per-shot assets are
  // the expensive, quota-consuming part of a run, and they are already
  // persisted by this point. A failed assembly (Remotion/Chromium missing,
  // render timeout, backend not serving /media) must not discard them or
  // mark an otherwise-successful generation as failed — it is recorded on
  // the storyboard and the run still returns its per-shot results.
  doc.video_url = undefined;
  doc.video_error = undefined;
  doc.thumbnail_url = undefined;
  doc.subtitles_url = undefined;
  doc.subtitled_video_url = undefined;
  doc.postprocess_error = undefined;
  try {
    const filename = 'storyboard.mp4';
    const mediaDir = path.join(generationService.GENERATED_DIR, doc.id);
    const videoPath = path.join(mediaDir, filename);
    const render = await remotionService.renderStoryboard(
      doc.shots,
      doc.world_state,
      videoPath,
    );
    doc.video_url = `/media/${doc.id}/${filename}`;

    // INTEG-002 (FR-9) — thumbnail + subtitles, the FFmpeg half of
    // post-processing. Runs only on a successful assembly (it operates on
    // the assembled file) and is non-fatal for the same reason assembly
    // itself is: the video and the per-shot assets are already saved, and a
    // missing poster frame is not a reason to report the run as broken.
    const post = await ffmpegService.postProcess({
      videoPath,
      mediaDir,
      mediaUrlBase: `/media/${doc.id}`,
      shots: doc.shots,
      renderedDurationInFrames: render && render.durationInFrames,
    });
    doc.thumbnail_url = post.thumbnail_url;
    doc.subtitles_url = post.subtitles_url;
    doc.subtitled_video_url = post.subtitled_video_url;
    doc.postprocess_error = post.error;
  } catch (assemblyErr) {
    doc.video_error = assemblyErr.message;
  }
  await doc.save();

  return {
    storyboardId: doc.id,
    shots: summary,
    videoUrl: doc.video_url || null,
    thumbnailUrl: doc.thumbnail_url || null,
    subtitlesUrl: doc.subtitles_url || null,
  };
}

generationQueue.process(processGeneration);

module.exports = { generationQueue, processGeneration };
