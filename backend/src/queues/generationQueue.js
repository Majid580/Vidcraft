const Queue = require('bull');

const Storyboard = require('../models/Storyboard');
const generationService = require('../services/generationService');

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

  return { storyboardId: doc.id, shots: summary };
}

generationQueue.process(processGeneration);

module.exports = { generationQueue, processGeneration };
