const express = require('express');

const Prompt = require('../models/Prompt');
const aiServiceClient = require('../services/aiServiceClient');
const { requireFields } = require('../middleware/validation');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

// POST /api/prompts — FR-1/FR-2: analyze a raw prompt, persist it, and
// return clarification questions when the analysis flagged anything.
router.post('/prompts', requireFields(['prompt']), async (req, res, next) => {
  try {
    const { prompt } = req.body;
    const analysis = await aiServiceClient.analyzePrompt(prompt);

    const doc = await Prompt.create({ raw_text: prompt, analysis });

    let clarificationQuestions;
    if (analysis.flags.length > 0) {
      const { questions } = await aiServiceClient.getClarificationQuestions(
        prompt,
        analysis.flags,
        analysis.suggestions,
        analysis.overall_score,
      );
      clarificationQuestions = questions;
    }

    res.status(201).json({
      promptId: doc.id,
      analysis,
      ...(clarificationQuestions ? { clarificationQuestions } : {}),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/prompts/:id/clarify — FR-2: merge clarification answers into
// the stored prompt's clarified_text.
router.post('/prompts/:id/clarify', requireFields(['answers']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { answers, questions } = req.body;

    const doc = await Prompt.findById(id);
    if (!doc) throw new ApiError(404, `Prompt ${id} not found`);

    const { brief, clarified_prompt: clarifiedPrompt } = await aiServiceClient.resolveClarification(
      doc.raw_text,
      questions || [],
      answers,
    );

    doc.clarified_text = clarifiedPrompt;
    await doc.save();

    res.status(200).json({ clarifiedPrompt, brief });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
