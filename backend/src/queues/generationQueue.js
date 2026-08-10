const Queue = require('bull');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Scaffold only (BACKEND-003) — a real "generation" job (render a shot via
// Remotion or an external API, per FR-5/FR-6) isn't wired in here yet;
// that's INTEG-001's job once BACKEND-005 exists too.
const generationQueue = new Queue('generation', REDIS_URL);

generationQueue.process(async (job) => ({ received: job.data }));

module.exports = { generationQueue };
