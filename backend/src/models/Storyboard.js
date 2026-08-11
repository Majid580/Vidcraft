const mongoose = require('mongoose');

const { RENDER_PROVIDERS } = require('../constants/renderProviders');

// Mirrors remotion/src/types.ts's WorldState/Shot shapes (which mirror
// the proposal's Section 6.3 example JSON) plus the generation-tracking
// fields (status, retry_count) from PROJECT_ARCHITECTURE.md Section
// 10.2's SHOTS entity, which have no Remotion-side equivalent since
// Remotion only ever renders a shot once it's already been decided.
//
// render_provider / pathway / provider are the user's explicit FR-6
// choice (ADR-020), stamped onto the storyboard and every shot by the
// route handler — not an agent decision (Producer/Router, AI-005, is
// retired).

const worldStateSchema = new mongoose.Schema(
  {
    characters: { type: [String], default: [] },
    setting: { type: String, required: true },
    style_tokens: { type: [String], default: [] },
    reference_image_url: { type: String },
  },
  { _id: false },
);

const shotSchema = new mongoose.Schema(
  {
    shot_id: { type: Number, required: true },
    description: { type: String, required: true },
    camera: { type: String, required: true },
    duration_s: { type: Number, required: true },
    pathway: { type: String, enum: ['remotion', 'external_api'], required: true },
    provider: { type: String, enum: RENDER_PROVIDERS, required: true },
    status: {
      type: String,
      // 'on_hold' is distinct from 'failed': it means generation was
      // deliberately not attempted (currently only the huggingface video
      // provider, paused pending a paid API key with higher limits — see
      // generationService.js) rather than attempted-and-errored.
      enum: ['pending', 'processing', 'completed', 'failed', 'on_hold'],
      default: 'pending',
    },
    retry_count: { type: Number, default: 0 },
    asset_url: { type: String },
    error: { type: String },
  },
  { _id: false },
);

const storyboardSchema = new mongoose.Schema(
  {
    prompt_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Prompt', required: true },
    world_state: { type: worldStateSchema, required: true },
    render_provider: { type: String, enum: RENDER_PROVIDERS, required: true },
    shots: { type: [shotSchema], default: [] },
    // The Bull job id of the most recent generation run for this storyboard
    // (INTEG-001). Lets POST /storyboards/:id/generate avoid enqueuing a
    // duplicate while one is still in flight, and lets a client reconnect to
    // GET /api/jobs/:id after a page reload. Bull/Redis remains the job store
    // (no separate Mongo `jobs` collection — Section 10.1 stays deferred).
    job_id: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

module.exports = mongoose.model('Storyboard', storyboardSchema);
