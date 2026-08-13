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

// FR-10 (NARR-001, ADR-032). A beat is one continuous thing happening with
// one line of voiceover over it. `duration_s` is MEASURED from the
// synthesised speech, never authored — the shot is then held for exactly as
// long as the beats it carries, which is what makes the voice and the
// picture impossible to desynchronise. A beat with empty narration is
// deliberately silent and still occupies time.
const beatSchema = new mongoose.Schema(
  {
    beat_id: { type: Number, required: true },
    action: { type: String, required: true },
    narration: { type: String, default: '' },
    duration_s: { type: Number, required: true },
    start_s: { type: Number },
    end_s: { type: Number },
    narration_url: { type: String },
    voice: { type: String },
    // Why this beat has no audio, when it was meant to. Synthesis failure is
    // per-beat and non-fatal: the beat degrades to a silent slot of the same
    // length rather than costing the whole render.
    narration_error: { type: String },
  },
  { _id: false },
);

const shotSchema = new mongoose.Schema(
  {
    shot_id: { type: Number, required: true },
    description: { type: String, required: true },
    camera: { type: String, required: true },
    // With narration this is the sum of the shot's MEASURED beat durations,
    // overwriting the Screenwriter's authored guess. Without it, that guess
    // stands, exactly as before.
    duration_s: { type: Number, required: true },
    beats: { type: [beatSchema], default: undefined },
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
    // retry_count now doubles as the CRITIC-001 (FR-8) retry counter: how
    // many times the vision-model quality gate has sent this shot back for
    // regeneration, bounded by CRITIC_MAX_RETRIES (default 2).
    retry_count: { type: Number, default: 0 },
    asset_url: { type: String },
    error: { type: String },
    // CRITIC-001 (FR-8): the vision model's verdict on the most recent
    // asset — logged per shot for the evaluation study, per the proposal's
    // "retry count and critic verdicts should be logged" requirement. null
    // until the critic loop has actually run (e.g. shot on_hold/failed
    // before reaching generation, or ai-service unreachable).
    critic_passed: { type: Boolean, default: null },
    critic_reason: { type: String },
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
    // FR-9: the assembled final video — every successfully generated shot
    // concatenated into one MP4 by the StoryboardVideo composition, with
    // per-shot camera movement. Set at the end of a generation run; stays
    // unset if no shot produced an asset, or if assembly itself failed (in
    // which case video_error explains why and the per-shot assets are still
    // there, still usable).
    video_url: { type: String },
    video_error: { type: String },
    // FR-9 post-processing (INTEG-002, ffmpegService): artifacts derived
    // from video_url after assembly. All optional and all additive — the
    // assembled master at video_url is never modified, so a run whose
    // post-processing failed still has its full deliverable. thumbnail_url
    // is the poster frame, subtitles_url a WebVTT track the browser's
    // <video><track> can display, subtitled_video_url a hardsubbed copy for
    // download/playback outside a captioning player.
    thumbnail_url: { type: String },
    subtitles_url: { type: String },
    subtitled_video_url: { type: String },
    postprocess_error: { type: String },
    // FR-10 (NARR-001, ADR-032). Why the voiceover was not produced, when it
    // was attempted. Narration is non-fatal in the same way assembly and
    // post-processing are: on failure every shot keeps its authored
    // duration_s and the video renders silently, so this field explains a
    // missing voice track rather than marking the run as broken. The beats
    // themselves live on each shot, since their timings ARE that shot's
    // timeline.
    narration_error: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

module.exports = mongoose.model('Storyboard', storyboardSchema);
