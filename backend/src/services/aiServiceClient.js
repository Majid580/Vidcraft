// Thin HTTP wrapper around the Python FastAPI ai-service (AI-001..005),
// the same "separate process, invoked over its real interface" pattern
// as remotionService.js uses for Remotion (per ADR-009). Uses Node's
// built-in fetch (Node 18+) rather than adding an HTTP client dependency.

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

async function post(path, body) {
  let res;
  try {
    res = await fetch(`${AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    const err = new Error(`ai-service unreachable at ${AI_SERVICE_URL}${path}: ${cause.message}`);
    err.statusCode = 502;
    throw err;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.detail || `ai-service ${path} returned ${res.status}`);
    // ai-service's own 422s are its input-validation errors, which are a
    // 400 by the time they've bubbled up through this backend's request.
    err.statusCode = res.status === 422 ? 400 : 502;
    throw err;
  }

  return data;
}

function analyzePrompt(prompt) {
  return post('/analyze', { prompt });
}

function getClarificationQuestions(prompt, flags, suggestions) {
  return post('/clarify/questions', { prompt, flags, suggestions });
}

function resolveClarification(prompt, questions, answers) {
  return post('/clarify/resolve', { prompt, questions, answers });
}

function generateStoryboard(clarifiedPrompt) {
  return post('/storyboard/generate', { clarified_prompt: clarifiedPrompt });
}

module.exports = {
  analyzePrompt,
  getClarificationQuestions,
  resolveClarification,
  generateStoryboard,
};
