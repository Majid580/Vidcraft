const mongoose = require('mongoose');

// Mirrors remotion/src/types.ts's WorldState/Shot shapes (which mirror
// the proposal's Section 6.3 example JSON) plus the generation-tracking
// fields (status, retry_count) from PROJECT_ARCHITECTURE.md Section
// 10.2's SHOTS entity, which have no Remotion-side equivalent since
// Remotion only ever renders a shot once it's already been decided.

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
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    retry_count: { type: Number, default: 0 },
  },
  { _id: false },
);

const storyboardSchema = new mongoose.Schema(
  {
    prompt_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Prompt', required: true },
    world_state: { type: worldStateSchema, required: true },
    shots: { type: [shotSchema], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

module.exports = mongoose.model('Storyboard', storyboardSchema);
