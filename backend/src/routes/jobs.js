const express = require('express');

const Storyboard = require('../models/Storyboard');
const { generationQueue } = require('../queues/generationQueue');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/jobs/:id — Section 9.3 (INTEG-001). Poll a generation job's
// status. Live job state/progress comes from Bull (Redis); the per-shot
// results (asset_url/status/error) come from the Storyboard doc the job is
// generating into, so a caller gets both the coarse job lifecycle and the
// fine-grained per-shot outcome from one call.
router.get('/jobs/:id', async (req, res, next) => {
  try {
    const job = await generationQueue.getJob(req.params.id);
    if (!job) throw new ApiError(404, `Job ${req.params.id} not found`);

    const state = await job.getState();
    const progress = job.progress();
    const storyboardId = job.data && job.data.storyboardId;
    const doc = storyboardId ? await Storyboard.findById(storyboardId) : null;

    res.status(200).json({
      jobId: String(job.id),
      state,
      progress: typeof progress === 'number' ? progress : 0,
      storyboardId: storyboardId || null,
      failedReason: job.failedReason || undefined,
      shots: doc ? doc.shots : [],
      // FR-9: the assembled final video, set by the job's last step. Absent
      // until the run finishes; videoError explains an assembly that failed
      // after the per-shot assets succeeded, so the UI can say the shots are
      // fine but the stitch isn't rather than implying the whole run failed.
      videoUrl: (doc && doc.video_url) || undefined,
      videoError: (doc && doc.video_error) || undefined,
      // FR-9 post-processing artifacts (INTEG-002). Each is independently
      // optional: post-processing is best-effort per artifact, so a run can
      // legitimately return a video with captions but no thumbnail.
      // postprocessError describes only what did NOT get made — the video
      // above it is unaffected either way.
      thumbnailUrl: (doc && doc.thumbnail_url) || undefined,
      subtitlesUrl: (doc && doc.subtitles_url) || undefined,
      subtitledVideoUrl: (doc && doc.subtitled_video_url) || undefined,
      postprocessError: (doc && doc.postprocess_error) || undefined,
      // FR-10 (ADR-032). Beats ride along inside `shots` above, since a
      // shot's beats are its timeline. This reports only a voiceover that
      // was attempted and failed — the video above is unaffected and plays
      // silently.
      narrationError: (doc && doc.narration_error) || undefined,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
