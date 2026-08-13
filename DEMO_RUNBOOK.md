# VidCraft — Live Demonstration Runbook

**DEMO-001.** Written from three real rehearsal runs on 2026-08-12, not from what the
system is supposed to do. Every timing below is measured, and the failures described
are ones that actually happened during the rehearsal.

Roadmap completion criterion: *"One successful live end-to-end run demonstrated (×3)."*
Met — see [Rehearsal log](#rehearsal-log).

---

## 1. Pre-flight (do this ~15 minutes before)

Four services. MongoDB runs as a Windows service and needs nothing.

| # | Service | Where | Command |
|---|---|---|---|
| 1 | Redis | Ubuntu (WSL) | `sudo service redis-server start` |
| 2 | ai-service | Ubuntu (WSL) | `cd /mnt/c/Users/majid/Desktop/fyp/ai-service && .venv-wsl/bin/uvicorn main:app --host 0.0.0.0 --port 8000` |
| 3 | backend | Windows PowerShell | `npm --prefix backend start` |
| 4 | frontend | Windows PowerShell | `npm --prefix frontend run dev` |

`--host 0.0.0.0` on uvicorn is **not optional** — see [ENV-001](#env-001-wsl-networking) below.

Confirm all four are reachable **from Windows** before you trust them:

```
Test-NetConnection localhost -Port 6379
Test-NetConnection localhost -Port 8000
Test-NetConnection localhost -Port 5000
```

### ⚠️ Warm up ai-service — the single most important step

**The first storyboard request after ai-service starts takes ~2 minutes.** That is
torch and the `all-MiniLM-L6-v2` embedder loading on first use. The Vite dev-server
proxy gives up before it finishes and the browser shows **502 Bad Gateway**.

This happened during rehearsal. The same request took **3.4 seconds** once warm.

So: **run one throwaway prompt end-to-end and discard it.** Do not skip this. A cold
start in front of an examiner looks exactly like a crash.

---

## 2. Which pathway to demo

Pick deliberately — they behave very differently under time pressure.

| Pathway | Wall-clock (measured) | Reliability in rehearsal | Use it for |
|---|---|---|---|
| **Remotion** | **~2 min** | 3/3 shots succeeded | **The live run.** Free, no external API, no quota, cannot fail on someone else's server |
| Cloudflare (FLUX) | ~2 min | 4/4 shots succeeded | A strong second — real photoreal imagery |
| Pollinations | ~3.5 min | **2 of 4 shots failed** (provider 500s) | Avoid live. Fine for a pre-recorded artifact |

**Recommendation: demo Remotion live, and show a pre-generated Cloudflare result** for
the photoreal output. Remotion is the guaranteed-consistency pathway (FR-5) and is the
one thing in the stack that cannot be broken by an external provider having a bad day.

If you do demo an external provider live, say up front that partial failure is expected
and handled — then it reads as designed robustness rather than a bug. Which it is: a
failed shot is dropped from the assembly and the video is still produced from the
shots that succeeded.

---

## 3. Demo script (~6 minutes)

**Prompt to use** (scored 74/100 in rehearsal, strong enough to skip clarification —
keeps the demo moving):

> A blacksmith hammers a glowing blade in a dim forge as sparks fly and dawn light
> creeps through the window.

| Step | What you show | Time | Say |
|---|---|---|---|
| 1 | Type the prompt, click **Analyze prompt** | ~25s | "spaCy scores five dimensions — subject clarity, action specificity, environment detail, visual richness, temporal coherence. This is FR-1." |
| 2 | The score + dimension bars | — | "74 is strong, so it skips straight to art direction. A weaker prompt opens a clarification chat instead — I'll show that after." |
| 3 | Style stage: pick Cinematic + **Remotion** | — | "The user picks the rendering pathway explicitly — that's ADR-020. No agent guesses it." |
| 4 | Click **Generate storyboard** | ~25s | "LangGraph now runs four agents: Screenwriter decomposes into shots, Cinematographer grounds each shot's camera in a 75-passage RAG index, then a sentence-similarity check verifies the storyboard still matches the prompt, with bounded retries." |
| 5 | Shot list appears; **the pipeline rail** advances through its five stages | ~60s | "This is the whole contribution on one screen — the four agents, then per-shot rendering, then assembly. Each shot renders through its own Bull job, and each square carries the critic's verdict: a shot that generated but failed critique looks different from one that failed outright, and it gets regenerated automatically." |
| 6 | Final video appears | ~30s | "Remotion assembles the shots into one continuous 1080p MP4 with per-shot camera moves, then FFmpeg adds the poster frame and captions." |
| 7 | **Press CC**, show captions; show both downloads | — | "Captions are generated from the shot descriptions and timed to the assembled cut. The clean master and a burned-in copy are both available." |

**Total: ~2 minutes of machine time.** Fill it with step 4's explanation — the
orchestration is the interesting part and it is exactly what is running while you talk.

### To also show clarification (optional, +1 min)

Use a vaguer prompt. This one triggered 2 questions in rehearsal:

> A cartographer unrolls an old map across a candlelit table in a stone tower while
> rain streaks the window behind her.

Answer both, click **Refine prompt** (~28s), and show the merged brief and the
rewritten clarified prompt.

---

## 4. Rehearsal log

Three runs, 2026-08-12, all through the real browser UI against the full stack —
real Groq, real RAG index, real Bull/Redis, real providers, real Remotion, real FFmpeg.
No stubs, no demo mode.

| # | Pathway | Prompt | Shots | Assembled | Frames | Total time | Artifacts | Result |
|---|---|---|---|---|---|---|---|---|
| 1 | Remotion | Blacksmith / forge | 3 | 3 of 3 | 360 = 12s | **122s** | poster + captions + hardsub | ✅ |
| 2 | Pollinations | Fisherman / net | 4 | 2 of 4 | 300 = 10s | **200s** | poster + captions + hardsub | ✅ (partial, by design) |
| 3 | Cloudflare | Cartographer / map | 4 | 4 of 4 | 480 = 16s | **115s** | poster + captions + hardsub | ✅ |

Every run: `postprocess_error` unset, frame count exactly equal to the assembled
shot durations × 30fps, and the UI rendered the poster, a working `<track>`, and both
download links.

**Run 2 is the most valuable of the three.** Two shots failed on real Pollinations 500s,
and the system did the right thing without being asked: the failed shots were dropped
from the assembly, the video was built from the two that worked, and — critically — the
captions described the *assembled* 10-second cut rather than the authored 17-second one,
starting at `00:00:00.000` with shot 2's text. That is the desync guard (ADR-028) proving
itself on real failure rather than in a test.

**Run 3 demonstrated the critic loop (FR-8) for real:** shots 1 and 4 passed the vision
critic first time; shots 2 and 3 failed and were automatically regenerated (2 and 1
retries respectively) before finalizing with their verdicts recorded. This is the
"demonstrated automatic re-generation cycle" FR-8 requires.

---

## 5. Known issues to have an answer ready for

### ENV-001: WSL networking

Redis inside WSL binds `127.0.0.1` *within WSL's namespace*. Windows cannot reach that,
and the failure is silent — Bull just can't connect, and **every** generation request
returns 500 while everything else looks healthy.

Fixed on this machine by binding Redis to `0.0.0.0` in `/etc/redis/redis.conf`.
The same trap applies to uvicorn, hence `--host 0.0.0.0`.

**If generation 500s on demo day, check Redis reachability from Windows first.**

### Groq free-tier quota

~100k tokens/day per model in practice (not the 1M headline — measured 2026-08-12).
Each full run costs several LLM calls. **Don't burn the morning of the demo on
rehearsals** — the quota resets on the UTC day boundary, and there is no same-day
recovery once it's gone. Rehearse the day before.

### Pollinations flakiness

2 of 4 shots failed with provider 500s during rehearsal. Not a code defect —
handled gracefully — but it is why Remotion is the recommendation for the live run.

### Hugging Face (video) is deliberately on hold

Selecting it returns every shot as `on_hold` with an explanatory message. This is
intentional (ADR-021) pending a paid key, not a bug. If asked: the free monthly
credits are exhausted, the code path is complete, and it resumes by removing one
entry from `HELD_PROVIDERS`.

### No authentication

R-9 is an open decision. There are no user accounts and no history — each session
starts fresh. Say so before someone asks.

---

## 6. If something breaks mid-demo

| Symptom | Cause | Do this |
|---|---|---|
| 502 on Generate | ai-service cold start | You skipped the warm-up. Retry — the second call is fast |
| 500 on Generate | Redis unreachable | `sudo service redis-server start` in Ubuntu, retry |
| Every shot `on_hold` | Hugging Face selected | Switch to Remotion |
| Some shots failed | External provider 500s | Expected — point at the video that was still produced |
| 429 / quota error | Groq daily cap | Switch to a pre-generated result. No same-day fix |
| Video shows text cards only | Remotion pathway with no images | Correct behaviour for that pathway — it's the motion-graphics fallback |

**Have a pre-generated storyboard open in a second tab.** If the live run fails for a
reason you can't fix in 30 seconds, switch to it and keep talking. The rehearsal
artifacts under `backend/generated/` are suitable.
