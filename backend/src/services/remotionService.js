const { execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// remotion/ is a sibling top-level directory, not a dependency of this
// package (per ADR-009 in PROJECT_ARCHITECTURE.md) — invoked as a child
// process, the same way FFmpeg will be (Section 6.5/6.8).
const REMOTION_DIR = path.join(__dirname, '..', '..', '..', 'remotion');
const RENDER_SCRIPT = 'render-shot.mjs';

/**
 * Renders a single shot via the Remotion pathway (FR-5). The actual
 * shot -> composition selection (REMOTION-003) lives in
 * remotion/render-shot.mjs, next to the compositions it selects between —
 * this function is a thin, safe process-invocation wrapper, not a second
 * copy of that decision.
 *
 * Shot/worldState text is untrusted (same as any user-derived prompt
 * content, per FR-1's security note) so it is written to a temp JSON file
 * and passed by path — never interpolated into a shell command string.
 * execFile + an argv array + shell:false means no shell ever parses this
 * content, regardless of what characters it contains.
 *
 * @param {object} shot
 * @param {object} worldState
 * @param {string} outputPath absolute or REMOTION_DIR-relative output path
 * @returns {Promise<{ compositionId: string, outputPath: string }>}
 */
function renderShot(shot, worldState, outputPath) {
  return new Promise((resolve, reject) => {
    const tmpPropsPath = path.join(
      os.tmpdir(),
      `vidcraft-shot-${shot.shot_id}-${Date.now()}.json`,
    );
    fs.writeFileSync(tmpPropsPath, JSON.stringify({ shot, worldState }));

    execFile(
      'node',
      [RENDER_SCRIPT, tmpPropsPath, outputPath],
      { cwd: REMOTION_DIR, shell: false, timeout: 120_000 },
      (error, stdout, stderr) => {
        fs.rmSync(tmpPropsPath, { force: true });

        if (error) {
          reject(new Error(`Remotion render failed: ${stderr || error.message}`));
          return;
        }

        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          resolve({ compositionId: undefined, outputPath });
        }
      },
    );
  });
}

module.exports = { renderShot };
