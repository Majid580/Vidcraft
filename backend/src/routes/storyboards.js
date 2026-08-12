const express = require('express');

const Prompt = require('../models/Prompt');
const Storyboard = require('../models/Storyboard');
const aiServiceClient = require('../services/aiServiceClient');
const { generationQueue } = require('../queues/generationQueue');
const { RENDER_PROVIDERS, pathwayForProvider } = require('../constants/renderProviders');
const { requireFields, requireOneOf } = require('../middleware/validation');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

// POST /api/storyboards — FR-3: run the LangGraph orchestrator
// (Screenwriter -> Cinematographer -> intent_check, AI-004/007/008)
// against a prompt's clarified text (falling back to raw text if never
// clarified), then stamp the user's explicit renderProvider choice (FR-6,
// ADR-020) onto every shot — no agent decides pathway anymore
// (Producer/Router, AI-005, is retired).
//
// The proposed shape (Section 9.2) is `202 {storyboardId, status:
// "processing"}` for an async job — but BACKEND-003's queue doesn't
// exist yet, so this call is synchronous today and returns the
// completed storyboard directly rather than faking an async status.
router.post(
  '/storyboards',
  requireFields(['promptId', 'renderProvider']),
  requireOneOf('renderProvider', RENDER_PROVIDERS),
  async (req, res, next) => {
    try {
      const { promptId, renderProvider } = req.body;
      const promptDoc = await Prompt.findById(promptId);
      if (!promptDoc) throw new ApiError(404, `Prompt ${promptId} not found`);

      const textToDecompose = promptDoc.clarified_text || promptDoc.raw_text;
      const result = await aiServiceClient.generateStoryboard(textToDecompose);

      const pathway = pathwayForProvider(renderProvider);
      const shots = result.shots.map((shot) => ({ ...shot, pathway, provider: renderProvider }));

      const storyboardDoc = await Storyboard.create({
        prompt_id: promptDoc._id,
        world_state: result.world_state,
        render_provider: renderProvider,
        shots,
      });

      res.status(201).json({
        storyboardId: storyboardDoc.id,
        status: 'completed',
        worldState: storyboardDoc.world_state,
        renderProvider: storyboardDoc.render_provider,
        shots: storyboardDoc.shots,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/storyboards/:id/generate — Section 9.3. INTEG-001: genuinely
// async now. Enqueues one Bull job (the whole storyboard) on the BACKEND-003
// `generation` queue and returns `202 {jobId, storyboardId, status}`
// immediately; the worker (queues/generationQueue.js) renders/generates each
// shot in the background, and the client polls GET /api/jobs/:id. This
// resolves the ADR-014 synchronous stopgap — the actual per-shot work is
// unchanged (same generationService adapters), just moved behind a job.
// Image providers (Pollinations, Cloudflare) and Remotion generate for real;
// the huggingface (video) provider is deliberately held, not attempted —
// see generationService.js's HELD_PROVIDERS.
router.post('/storyboards/:id/generate', async (req, res, next) => {
  try {
    const doc = await Storyboard.findById(req.params.id);
    if (!doc) throw new ApiError(404, `Storyboard ${req.params.id} not found`);

    // If a generation job for this storyboard is still in flight, hand back
    // the same job rather than starting a duplicate run.
    if (doc.job_id) {
      const existing = await generationQueue.getJob(doc.job_id);
      if (existing) {
        const state = await existing.getState();
        if (state === 'waiting' || state === 'active' || state === 'delayed') {
          return res.status(202).json({
            jobId: String(existing.id),
            storyboardId: doc.id,
            status: state,
          });
        }
      }
    }

    // Fresh run: enqueue one job for the whole storyboard, then atomically
    // claim it on the storyboard doc via a compare-and-swap on job_id. R-14:
    // two genuinely concurrent requests can both pass the in-flight check
    // above (both see no active job) and both reach this point — with a
    // Mongoose `doc.save()`, the second one used to throw a raw 500
    // (VersionError). We go through the native MongoDB collection instead of
    // Mongoose's `findOneAndUpdate`/`save()`, because Mongoose adds its own
    // implicit version-key guard on top of any update that touches an array
    // via positional operators, which fights with a hand-rolled CAS instead
    // of composing with it. The native driver gives exactly the atomicity we
    // want: only the request whose query still matches the job_id it read,
    // at the moment MongoDB actually executes the write, wins the claim.
    const job = await generationQueue.add({ storyboardId: doc.id });
    const jobIdMatch = doc.job_id ? doc.job_id : { $exists: false };
    const claimResult = await Storyboard.collection.findOneAndUpdate(
      { _id: doc._id, job_id: jobIdMatch },
      {
        $set: {
          job_id: String(job.id),
          'shots.$[].status': 'pending',
          'shots.$[].asset_url': null,
          'shots.$[].error': null,
          // A fresh run re-anchors from scratch (FR-7): the continuity
          // reference is the first frame *this* run generates, not a
          // leftover from the previous one, whose asset_url we just cleared.
          'world_state.reference_image_url': null,
          // Likewise the assembled video (FR-9) — it describes the old run.
          video_url: null,
          video_error: null,
        },
      },
      { returnDocument: 'after' },
    );
    const claimed = claimResult && claimResult.value !== undefined ? claimResult.value : claimResult;

    if (!claimed) {
      // Lost the race: another concurrent request already claimed a new run
      // between our read and our write. Discard our now-redundant job and
      // hand back the winner's, so the caller still gets a valid in-flight
      // job instead of an error.
      try {
        const orphan = await generationQueue.getJob(job.id);
        if (orphan) await orphan.remove();
      } catch {
        // Best-effort cleanup only; the orphaned job is harmless if this fails.
      }
      const winner = await Storyboard.findById(req.params.id);
      return res.status(202).json({
        jobId: winner.job_id,
        storyboardId: winner.id,
        status: 'queued',
      });
    }

    res.status(202).json({
      jobId: String(job.id),
      storyboardId: String(claimed._id),
      status: 'queued',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/storyboards/:id — fetch a storyboard's current state.
router.get('/storyboards/:id', async (req, res, next) => {
  try {
    const doc = await Storyboard.findById(req.params.id);
    if (!doc) throw new ApiError(404, `Storyboard ${req.params.id} not found`);
    res.status(200).json(doc);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
