const mongoose = require('mongoose');

// Field names are snake_case to match the wire-format JSON shown in
// VidCraft_Proposal.tex Section 6.1/6.3 and remotion/src/types.ts — the
// ER diagram in PROJECT_ARCHITECTURE.md Section 10.2 draws these in
// camelCase, which this schema deliberately does not follow, to avoid a
// translation layer between API request bodies and stored documents.
//
// `analysis` is Mixed because FR-1's exact scoring shape (dimensions,
// weights) is still an open design decision (PROJECT_ARCHITECTURE.md
// risk R-12) — tighten this once AI-002 settles the real shape.
const promptSchema = new mongoose.Schema(
  {
    raw_text: { type: String, required: true },
    clarified_text: { type: String },
    analysis: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

module.exports = mongoose.model('Prompt', promptSchema);
