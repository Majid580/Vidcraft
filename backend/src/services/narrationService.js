const fs = require('fs');
const path = require('path');

const aiServiceClient = require('./aiServiceClient');
const { assembledShots } = require('./remotionService');

const NARRATION_ENABLED = String(process.env.NARRATION_ENABLED ?? 'true').toLowerCase() !== 'false';
const NARRATION_VOICE = process.env.NARRATION_VOICE || '';

/**
 * FR-10 (NARR-001, ADR-032) — attach a measured voiceover track to a
 * storyboard's shots, in place.
 *
 * Runs AFTER per-shot generation and BEFORE assembly, and that ordering is
 * load-bearing in both directions.
 *
 * *After generation*, because narration is written only for the shots that
 * actually survived: a shot whose provider failed is dropped from the video
 * and occupies no time on the timeline, so narrating it would push every
 * later line ahead of its picture. This is the same guard ADR-028 put on
 * captions, and for the same reason — it is not hypothetical, real provider
 * 500s drop shots on ordinary runs.
 *
 * *Before assembly*, because this REPLACES each narrated shot's `duration_s`
 * with the sum of its measured beats. The video is fitted to the audio, not
 * the reverse: Remotion's `framesFor(shot)` takes duration as an input, so a
 * shot held for exactly as long as the speech it carries cannot drift from
 * it. Constraining narration to the authored duration instead — some
 * words-per-second budget — accumulates error until the voice describes the
 * wrong picture.
 *
 * Wholly non-fatal, like assembly (ADR-027) and post-processing (ADR-028).
 * By the time this runs the quota-expensive per-shot assets already exist,
 * and a missing voiceover is not a reason to lose them: on any failure the
 * shots keep their authored durations and the render proceeds silently.
 *
 * @param {object} doc            the Storyboard mongoose document (mutated)
 * @param {string} mediaDir       absolute directory to write audio into
 * @param {string} mediaUrlBase   URL prefix that maps to mediaDir
 * @returns {Promise<{narrated: number, spokenBeats: number, error?: string}>}
 */
async function attachNarration(doc, mediaDir, mediaUrlBase) {
  if (!NARRATION_ENABLED) return { narrated: 0, spokenBeats: 0 };

  const renderable = assembledShots(doc.shots);
  if (renderable.length === 0) return { narrated: 0, spokenBeats: 0 };

  try {
    const payload = renderable.map((shot) => ({
      shot_id: shot.shot_id,
      description: shot.description,
      camera: shot.camera,
    }));

    const result = await aiServiceClient.generateNarration(
      payload,
      doc.world_state,
      NARRATION_VOICE,
    );

    const byShotId = new Map((result.shots || []).map((s) => [s.shot_id, s]));
    fs.mkdirSync(mediaDir, { recursive: true });

    let spokenBeats = 0;
    let narrated = 0;

    for (const shot of renderable) {
      const scripted = byShotId.get(shot.shot_id);
      if (!scripted || !Array.isArray(scripted.beats) || scripted.beats.length === 0) continue;

      const beats = scripted.beats.map((beat) => {
        const record = {
          beat_id: beat.beat_id,
          action: beat.action,
          narration: beat.narration || '',
          duration_s: beat.duration_s,
          start_s: beat.start_s,
          end_s: beat.end_s,
          voice: beat.voice,
          narration_error: beat.narration_error,
        };

        if (beat.audio_base64) {
          const filename = `narration-${shot.shot_id}-${beat.beat_id}.mp3`;
          fs.writeFileSync(
            path.join(mediaDir, filename),
            Buffer.from(beat.audio_base64, 'base64'),
          );
          record.narration_url = `${mediaUrlBase}/${filename}`;
          spokenBeats += 1;
        }
        return record;
      });

      shot.beats = beats;
      // The measured timeline wins over the Screenwriter's authored guess.
      shot.duration_s = Number(
        beats.reduce((sum, beat) => sum + beat.duration_s, 0).toFixed(3),
      );
      narrated += 1;
    }

    return { narrated, spokenBeats };
  } catch (err) {
    // Leave every shot's authored duration untouched so the render is
    // exactly what it would have been without narration.
    return { narrated: 0, spokenBeats: 0, error: err.message };
  }
}

module.exports = { attachNarration, NARRATION_ENABLED };
