const express = require('express');

const Prompt = require('../models/Prompt');
const generationService = require('../services/generationService');
const { IMAGE_PROVIDERS } = require('../constants/renderProviders');
const { requireFields, requireOneOf } = require('../middleware/validation');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

// POST /api/images — single-image mode: skips the Screenwriter/storyboard
// shot decomposition (POST /api/storyboards) entirely. Takes the prompt's
// already-enhanced text (FR-1/FR-2, same as the storyboard flow) plus any
// style tokens, and generates exactly one real image via an explicit
// user-picked image provider (Pollinations or Cloudflare — Remotion needs
// a shot to render and Hugging Face is video-only, so neither applies).
router.post(
  '/images',
  requireFields(['promptId', 'provider']),
  requireOneOf('provider', IMAGE_PROVIDERS),
  async (req, res, next) => {
    try {
      const { promptId, provider, styleTokens } = req.body;
      const promptDoc = await Prompt.findById(promptId);
      if (!promptDoc) throw new ApiError(404, `Prompt ${promptId} not found`);

      const basePrompt = promptDoc.clarified_text || promptDoc.raw_text;
      const enhancedPrompt = Array.isArray(styleTokens) && styleTokens.length > 0
        ? [basePrompt, ...styleTokens].join(', ')
        : basePrompt;

      const imageUrl = await generationService.generateSingleImage(promptDoc.id, provider, enhancedPrompt);

      promptDoc.image_provider = provider;
      promptDoc.image_url = imageUrl;
      await promptDoc.save();

      res.status(201).json({
        promptId: promptDoc.id,
        provider,
        originalPrompt: promptDoc.raw_text,
        enhancedPrompt,
        imageUrl,
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
