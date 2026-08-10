const express = require('express');

const Prompt = require('../models/Prompt');
const Storyboard = require('../models/Storyboard');
const aiServiceClient = require('../services/aiServiceClient');
const { requireFields } = require('../middleware/validation');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

// POST /api/storyboards — FR-3: run the LangGraph orchestrator
// (Screenwriter -> Producer/Router, AI-004/AI-005) against a prompt's
// clarified text (falling back to raw text if never clarified) and
// persist the result.
//
// The proposed shape (Section 9.2) is `202 {storyboardId, status:
// "processing"}` for an async job — but BACKEND-003's queue doesn't
// exist yet, so this call is synchronous today and returns the
// completed storyboard directly rather than faking an async status.
router.post('/storyboards', requireFields(['promptId']), async (req, res, next) => {
  try {
    const { promptId } = req.body;
    const promptDoc = await Prompt.findById(promptId);
    if (!promptDoc) throw new ApiError(404, `Prompt ${promptId} not found`);

    const textToDecompose = promptDoc.clarified_text || promptDoc.raw_text;
    const result = await aiServiceClient.generateStoryboard(textToDecompose);

    const storyboardDoc = await Storyboard.create({
      prompt_id: promptDoc._id,
      world_state: result.world_state,
      shots: result.shots,
    });

    res.status(201).json({
      storyboardId: storyboardDoc.id,
      status: 'completed',
      worldState: storyboardDoc.world_state,
      shots: storyboardDoc.shots,
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
