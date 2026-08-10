# PROJECT_PROGRESS.md — VidCraft Development State

> **Document type:** Living progress tracker (the "where development CURRENTLY stands" document).
> **Companion documents:** [`PROJECT_ARCHITECTURE.md`](PROJECT_ARCHITECTURE.md) (what the project is and how it should work — read that first if you haven't), [`PROJECT_STATE.yaml`](PROJECT_STATE.yaml) (machine-readable mirror of this file).
> **This file must be updated by every agent/developer session that changes the codebase.** `PROJECT_ARCHITECTURE.md` changes rarely (only when the actual architecture changes); this file changes constantly.
> **Golden rule:** nothing gets marked `VERIFIED` here because a document says so or because code "looks plausible." It gets marked `VERIFIED` because someone actually inspected the file(s) and/or ran the code/tests and recorded what they checked, below.

---

## 1. Current Project Status

| Field | Value |
|---|---|
| **Overall completion percentage** | **~60.0%** — computed as (verified tasks) / (total tasks in the Section 20 roadmap of `PROJECT_ARCHITECTURE.md`) = 21 / 35 |
| **Current phase** | Phase 0/1 complete; Phase 4 (Remotion Integration) done; Phase 5 HIGH tasks (AI-002..006) all complete; into Phase 2/3/6 (Backend/DB, Frontend Dev, RAG) |
| **Current milestone** | M1 "Development environment and technology feasibility confirmed" — reached 2026-08-10 |
| **Current objective** | RAG-003 (embed the RAG-002 corpus + populate/persist the vector index, then the deferred MongoDB embeddings sync) — now fully unblocked since both deps (RAG-001 scaffold + RAG-002 curated corpus) are VERIFIED; it directly unblocks AI-007 (Cinematographer). NOTE: ADR-015 (no local heavy compute) is firm for LLMs; RAG-003's local-torch embeddings migration is DEFERRED (user, 2026-08-10) — keep local for now, move to a hosted embeddings API only if it slows the machine. |
| **Overall status** | 🟢 **The first real slice of the pipeline is now reachable end-to-end through the actual Node backend, not just the ai-service port directly.** FR-1 (AI-002), FR-2 (AI-003), and a growing slice of FR-3 (AI-004 Screenwriter + AI-005 Producer/Router) are implemented and verified end-to-end, and as of BACKEND-004 that whole chain round-trips through real REST routes (`POST /api/prompts`, `POST /api/prompts/:id/clarify`, `POST /api/storyboards`, `GET /api/storyboards/:id`) backed by MongoDB persistence and a real HTTP call to ai-service (`aiServiceClient.js`): a vague prompt (35/100, 3 flags) → 2 real Groq-generated clarifying questions → answers merged into a clarified prompt → a real LangGraph `StateGraph` (`screenwriter` → `producer` → END) storyboard, persisted and fetchable. Error paths (400 validation, 404 unknown/malformed id, 502 ai-service failure) also verified. The remotion-routed shot pathway separately chains into REMOTION-003's `remotionService.renderShot()` (not yet wired into the storyboard routes themselves — that's INTEG-001). Still open: no queue (BACKEND-003) means `POST /api/storyboards` is synchronous rather than the originally proposed async 202/processing shape (ADR-014); Cinematographer (AI-007) doesn't exist yet, so `camera` is still a Screenwriter draft, not RAG-grounded (ADR-012); shots routed to `external_api` can't actually be rendered yet since BACKEND-005/PROVIDER-001 don't exist. FR-4/FR-6..FR-12 remain unimplemented. Note: the project's Groq API key is free-tier (30 req/min, 1,000 req/day) — keep this in mind for any future live-LLM testing or the eventual evaluation study. |
| **Last updated** | 2026-08-10 |
| **Last updated by** | Claude (Opus 4.8) — completed RAG-002 (curated cinematography reference corpus: 75 license-clean, original technique summaries across 8 categories in `ai-service/rag/corpus/cinematography.json` + a validating `load_corpus()` loader + `test_corpus.py`; validated offline — shape/uniqueness/coverage). Branch `rag-002-corpus` (off the `frontend-003-ui` tip). Prior: FRONTEND-003 on `frontend-003-ui` (pushed). |

**Why 0% and not some nonzero "planning is progress" number:** the percentage in this file is defined as *verified implementation* progress against the roadmap, not planning/documentation progress. The proposal and this documentation system are real, substantial work — but they are inputs to development, not development itself. Do not inflate this number to make the project look further along than it is.

---

## 2. Completed Features

| ID | Feature | Status | Implementation | Verification | Date |
|---|---|---|---|---|---|
| RAG-002 | Curate cinematography reference corpus | VERIFIED | `ai-service/rag/corpus/` — `cinematography.json` (**75** curated `{text, metadata}` passages), `loader.py` (`load_corpus()` reads + strictly validates into the exact `VectorIndex.add()` item shape; dedups `metadata.id`; raises `CorpusError` on missing/malformed/duplicate input), `__init__.py`, `README.md`. Coverage across 8 categories: framing 11 / angle 6 / movement 11 / lens 8 / lighting 14 / color 8 / composition 8 / mood 9. Every passage is an **original summary of common-knowledge film-technique craft** written for this project (license-clean per the FR-4 security note — nothing copied), phrased with mood vocabulary (*tense/romantic/epic/eerie*…) so shot-description queries retrieve well. Corpus curation only — embedding + populating a persisted index is RAG-003; no Cinematographer consumer yet (AI-007). | Offline validation via the loader on Windows Python (no torch/faiss): 75 items load; all 8 categories present, none thin (min 6 each); all `metadata.id` unique; every item is `{text, metadata}` with non-empty text and ≥3 tags; `load_corpus()` raises `CorpusError` on a missing file. Mirrors `ai-service/tests/test_corpus.py` (7 offline, dependency-light tests → pass under WSL2 pytest too). | 2026-08-10 |
| FRONTEND-003 | Style configurator UI | VERIFIED | `frontend/src/components/StyleConfigurator/` — `styleOptions.ts` (declarative catalog: 8 visual styles, 6 moods, 6 lighting, 6 palettes, 4 aspect ratios; `StyleConfig` type + `DEFAULT_STYLE_CONFIG` + `toStyleTokens()` which flattens to a flat `style_tokens[]`, emitting aspect ratio as an `aspect:<r>` token) and `index.tsx` (the configurator: 3D-styled selectable tiles, conic-gradient palette **orbs** with a glossy highlight, mini aspect-ratio **frames**, a free-form custom-token input capped at 6, and a live summary showing the flattened tokens + Generate CTA). New 4th flow stage **Style** (`FlowSteps.tsx`: Compose → Refine → Style → Storyboard) replaces FRONTEND-002's plain "Ready to storyboard" block; `App.tsx` holds `styleConfig` state and passes `toStyleTokens(styleConfig)` to `api.generateStoryboard(promptId, styleTokens, demo)` (`lib/api.ts` now sends `styleTokens` in the `POST /api/storyboards` body; `lib/demo.ts` reflects them into `world_state.style_tokens`). New CSS utilities in `index.css` (`.card-3d-pop` spring hover-lift, `.tile-in` staggered entrance with `back.out` overshoot, `.animate-pop`) reusing the existing glass/tilt-3d/Reveal/violet→cyan system. Aligns with the ui-ux-pro-max Aurora-UI + Glassmorphism + 3D-depth direction and the motion DB's stagger/hover presets. **Scope:** the backend does not yet *read* `styleTokens` (full wiring into ai-service `world_state.style_tokens` is INTEG-001) — "included in submission payload" criterion is met; demo mode reflects them locally. | Clean production build (`npm run build`: full `tsc -b` type-check with `noUnusedLocals`/`noUnusedParameters` + `vite build`, 1919 modules, 0 errors). Driven end-to-end in the live browser preview via demo mode: reached the new **Style** stage, selected visual style + mood + 2 lighting + Warm Sunset palette + Cinemascope aspect + a custom token → live summary flattened to **"7 style tokens"** → generated → the storyboard's `world_state.style_tokens` reflected exactly those picks (with `aspect:2.39:1` correctly excluded from the descriptive style list). 0 React/console errors (only the expected 502 from the offline backend that triggers demo mode); no horizontal overflow at 375px. Also fixed a **pre-existing** `npm run build` blocker: `tsconfig.app.json`'s `baseUrl` tripped TS5101 under the repo's `typescript ~6.0.2`, failing `tsc -b` before `vite build` ran — added the TS-recommended `ignoreDeprecations: "6.0"` (baseUrl still needed for the `@/*` paths mapping). Added `autoPort:true` (`.claude/launch.json`) + a `PORT`-env read (`vite.config.ts`) so a preview can run beside another session's :5173 server. Not yet committed. | 2026-08-10 |
| FRONTEND-002 | Prompt input + clarification chat UI | VERIFIED | `frontend/src/` — a guided **Compose → Refine → Storyboard** SPA. Components: `App.tsx` (flow state machine), `components/{PromptComposer,AnalysisPanel,ClarificationChat,StoryboardView,FlowSteps,AppHeader,ThemeToggle,AuroraBackground,Reveal}.tsx`, `components/ui/{card,badge,textarea}.tsx`. Data: `lib/api.ts` (typed client over the Vite `/api → :5000` proxy in `vite.config.ts`), `lib/types.ts`, `lib/demo.ts`. Theming: `hooks/useTheme.ts` + anti-FOUC script in `index.html` (light/dark, localStorage + system-pref). Visual system: violet→indigo→cyan gradient, aurora orbs, 3D scroll reveal, hover-lift/glow + pointer 3D tilt (`hooks/useTilt.ts`). Offline: a connection/502 shows a friendly message + "Explore in demo mode" (sample data via `lib/demo.ts`). Fix: clarify `brief` is a structured object from ai-service, not a string — renders either shape. | Ran the full flow through the live browser UI against the running stack (backend :5000 + ai-service :8000 + MongoDB + Redis): vague prompt → real spaCy analysis (51/100) + real Groq questions → answers → real Groq clarified prompt + structured brief → real LangGraph storyboard with pathway badges. **0 console/React errors** (verified via installed `console.error` hook), TypeScript clean, light/dark token flip confirmed, no horizontal overflow at 375px. Committed `frontend-002-ui` (0d5429f), pushed. | 2026-08-10 |
| AI-006 | Groq + hosted fallback LLM integration | VERIFIED | `ai-service/llm/completion.py` (`complete_json` — the unchanged single entrypoint; tries Groq primary, on a `_FALLBACKABLE` failure [`GroqConfigError` \| `groq.APIError` \| `json.JSONDecodeError`] falls back, else re-raises; `LLMError` when fallback disabled/both fail), `ai-service/llm/groq_client.py` (primary renamed to `groq_complete_json`), `ai-service/llm/http_llm_client.py` (`fallback_complete_json` — httpx POST to any OpenAI-compatible `/chat/completions`, JSON mode, `FallbackLLMError`), `ai-service/config.py` (+`LLM_FALLBACK_ENABLED`/`FALLBACK_LLM_BASE_URL`/`FALLBACK_LLM_API_KEY`/`FALLBACK_LLM_MODEL`/`LLM_TIMEOUT_SECONDS`), `.env.example` updated. Per ADR-015 the fallback is HOSTED, never a local model (an Ollama draft was written and removed after a >120s local warm-up); default is a second Groq model `llama-3.1-8b-instant` on the same free key (ADR-016). | 46/46 pytest pass (11 new in `tests/test_llm.py`, providers mocked — no network). Live end-to-end from `.venv-wsl`: real Groq primary via `llm.complete_json` → `{'city':'Tokyo'}`; then with the primary forced to raise `APIConnectionError`, `llm.complete_json` transparently used the REAL hosted fallback (`llama-3.1-8b-instant`) → `{'city':'Rome'}`, logging the documented fallback warning. Existing callers (AI-003/004/005) and their tests untouched. | 2026-08-10 |
| RAG-001 | FAISS vector-index scaffold (FR-4 infra) | VERIFIED | `ai-service/rag/index.py` (`VectorIndex`: FAISS `IndexFlatIP` over L2-normalized vectors = cosine per FR-4, parallel JSON metadata sidecar `{path}.faiss`+`{path}.meta.json`, graceful empty-index queries, `save`/`load`, injectable `embed_fn`), `ai-service/rag/embedder.py` (lazy cached `all-MiniLM-L6-v2`, imported only on first real embed so empty paths/tests need no model), `ai-service/rag/__init__.py`; `config.py` adds `EMBEDDING_MODEL`/`EMBEDDING_DIM`/`VECTOR_INDEX_PATH`/`RAG_TOP_K`; `requirements.txt` += faiss-cpu 1.15.0, sentence-transformers 5.7.0, torch 2.13.0+cpu (into `.venv-wsl`) | 9/9 new pytest pass (35/35 total) with a deterministic injected embedder (offline). Live end-to-end with the REAL `all-MiniLM-L6-v2`: empty 384-dim index → `[]` on query; 4-item cinematography corpus embedded; semantic query "dark shadowy scene that feels tense" ranked the low-key/deep-shadows lighting passage first (0.383 cosine); save+reload round-trip preserved all 4 vectors. Temp verification script cleaned up, not committed. | 2026-08-10 |
| BACKEND-003 | Redis + Bull.js queue scaffold | VERIFIED | `backend/src/queues/generationQueue.js` (Bull queue named `generation`, connects to `REDIS_URL`, placeholder processor that echoes `job.data`); Redis installed inside WSL2 (`sudo apt install redis-server`, same WSL2 pattern as ADR-008) rather than retrying Docker (still broken per BLOCK-002) | Confirmed Redis reachable from Windows on `redis://localhost:6379` (`Test-NetConnection`, `TcpTestSucceeded: True`). Ran a temporary script: enqueued a trivial job, awaited `job.finished()`, got back the exact echoed payload, closed the queue connection. Script deleted after verification, nothing left running that isn't source-controlled. | 2026-08-10 |
| BACKEND-004 | REST routes, middleware, error handler | VERIFIED | `backend/src/routes/prompts.js` (`POST /api/prompts`, `POST /api/prompts/:id/clarify`), `backend/src/routes/storyboards.js` (`POST /api/storyboards`, `GET /api/storyboards/:id`), `backend/src/services/aiServiceClient.js` (fetch-based HTTP client to ai-service, maps ai-service 422→400 and network/5xx failures→502), `backend/src/middleware/validation.js` (`requireFields`), `backend/src/middleware/errorHandler.js` (`ApiError`, `notFoundHandler`, centralized handler incl. Mongoose `CastError`/`ValidationError`→400 mapping), wired into `backend/src/app.js` (`connectDB()` now called on startup) | Live end-to-end via curl against a running backend (port 5000) + ai-service (WSL2, port 8000) + real local MongoDB: `POST /api/prompts` with a vague prompt returned real spaCy analysis (35/100, 3 flags) and 2 real Groq clarification questions, persisted; `POST /api/prompts/:id/clarify` merged real answers into a clarified prompt via Groq, persisted; `POST /api/storyboards` ran the real LangGraph orchestrator and persisted a 4-shot storyboard; `GET /api/storyboards/:id` fetched it back correctly. Error paths verified: 400 (missing field), 404 (valid-but-unknown id, unknown route), 400 (malformed ObjectId via CastError mapping). Test documents deleted after verification. Deviates from the Section 9.2 PROPOSED async shape for `POST /api/storyboards` — see ADR-014. | 2026-08-10 |
| AI-005 | LangGraph orchestrator: Producer/Router agent (FR-3, partial) | VERIFIED | `ai-service/orchestrator/agents/producer.py` (`assign_pathways`: per-shot LLM routing decision, `ProducerOutputError` on malformed output), `ai-service/orchestrator/graph.py` (added `producer` node: `screenwriter` → `producer` → END) | 26/26 pytest pass (4 new, LLM mocked via monkeypatch). Live end-to-end against the real Groq API: a prompt mixing an explicit photorealistic shot with two stylized/animated shots correctly routed 1 shot to `external_api` and 2 to `remotion`, per the ADR-013 heuristic — replacing AI-004's hardcoded `"remotion"` default with a real per-shot decision. | 2026-08-10 |
| AI-004 | LangGraph orchestrator: Screenwriter agent (FR-3, partial) | VERIFIED | `ai-service/orchestrator/state.py` (`OrchestratorState` TypedDict), `ai-service/orchestrator/agents/screenwriter.py` (`run_screenwriter`, output-shape validation via `ScreenwriterOutputError`), `ai-service/orchestrator/graph.py` (real LangGraph `StateGraph`, single `screenwriter` node, per ADR-001), `POST /storyboard/generate` in `ai-service/main.py` | 22/22 pytest pass (5 new, LLM mocked via monkeypatch). Live end-to-end against the real Groq API: clarified prompt → valid 3-shot storyboard (`storyboard_id`, `world_state`, `shots[]` matching the FR-3 JSON shape exactly). Further verified that storyboard's shot 1 chains directly into `backend/src/services/remotionService.js`'s `renderShot()` (REMOTION-003) — correctly selected `MediumShot` from the LLM-drafted `camera` value, rendered a valid MP4 (confirmed via ISO Media container magic bytes; `ffprobe` not on this shell's PATH, a known pre-existing quirk). Also verified 422 on empty `clarified_prompt`. | 2026-08-10 |
| AI-003 | Conversational clarification agent (FR-2) | VERIFIED | `ai-service/llm/groq_client.py` (Groq SDK wrapper, JSON-mode structured completions), `ai-service/clarification/agent.py` (`generate_questions` <=2 questions, `build_brief` merges answers), `ai-service/config.py` (env loading), `POST /clarify/questions` + `POST /clarify/resolve` in `ai-service/main.py` | 17/17 pytest tests pass (7 new, LLM mocked via monkeypatch). Live end-to-end against the real Groq API: vague prompt (33/100, 3 flags) → 2 real generated questions → resolved into brief + clarified prompt → re-analyzed at 72/100 with 0 flags. No-flags no-op path and mismatched-length 400 error path also verified. | 2026-08-10 |
| AI-002 | spaCy prompt analyzer (FR-1) | VERIFIED | `ai-service/analyzer/pipeline.py` (cached spaCy load), `ai-service/analyzer/scoring.py` (5-dimension heuristic scorer, flags/suggestions), `ai-service/analyzer/antonyms.json` (36-pair domain antonym dictionary), `POST /analyze` in `ai-service/main.py` | 9/9 pytest unit tests pass (`ai-service/tests/test_analyzer.py`) in `.venv-wsl`; started uvicorn and curled `/analyze` for a vague prompt (`vague_action`/`missing_setting`/`low_visual_detail` flagged, 35/100), a rich prompt (86/100, no flags), and a whitespace-only prompt (422 rejected) | 2026-08-10 |
| SETUP-002 | Git repo + base folder structure | VERIFIED | `.git/`, `.gitignore`, `frontend/`, `backend/`, `ai-service/` (placeholder READMEs only); pushed to `origin/main` at https://github.com/Majid580/Vidcraft | `git status` succeeds; three top-level dirs confirmed present via file listing; `git push` succeeded | 2026-08-10 |
| SETUP-001 | Technology feasibility testing | VERIFIED (blocker found and resolved) | See Section 5 below for the full per-tool results | Version checks + `import` smoke tests run directly on the dev machine, see Section 5 | 2026-08-10 |
| BACKEND-001 | Express app scaffold | VERIFIED | `backend/src/app.js`, `backend/src/routes/health.js` (Helmet, CORS, Morgan, dotenv wired in) | Ran `node src/app.js`, `curl localhost:5000/api/health` → 200 `{"status":"ok","service":"backend"}` | 2026-08-10 |
| AI-001 | FastAPI microservice scaffold | VERIFIED | `ai-service/main.py`, `ai-service/requirements.txt`, run via `ai-service/.venv-wsl` in WSL2 (ADR-008) | Ran `uvicorn main:app` in WSL2, `curl localhost:8000/health` → 200 `{"status":"ok","service":"ai-service"}` | 2026-08-10 |
| SETUP-003 | `.env.example` | VERIFIED | `.env.example` (repo root, mirrors PROJECT_ARCHITECTURE.md Section 13); `backend/.env` created locally from it | `git check-ignore -v backend/.env` confirmed it's excluded from version control | 2026-08-10 |
| BACKEND-002 | MongoDB connection + Mongoose schemas | VERIFIED | `backend/src/config/db.js` (connectDB), `backend/src/models/Prompt.js`, `backend/src/models/Storyboard.js` (embedded `world_state`/`shots` subdocuments) | Connected to a real local MongoDB instance; created + read back a Prompt and a Storyboard with nested world_state/shots; deleted test docs; closed connection cleanly. Field names use snake_case to match the proposal's wire format (see naming note added to Section 10) | 2026-08-10 |
| REMOTION-003 | Shot → composition mapping logic | VERIFIED | `remotion/render-shot.mjs` (`selectCompositionId`, `@remotion/bundler`+`@remotion/renderer` programmatic render), `backend/src/services/remotionService.js` (safe `execFile` wrapper, no shell interpolation) | Ran `remotionService.renderShot()` for a matching shot (`camera: "close-up, static"` → `CloseUpShot`) and a deliberately unrecognized one (`camera: "aerial drone, 360 orbit"` → falls back to `MediumShot`, no throw); both output MP4s `ffprobe`-verified valid. Resolves R-11. | 2026-08-10 |
| REMOTION-002 | Composition library (WideShot/MediumShot/CloseUpShot) | VERIFIED | `remotion/src/types.ts` (Shot/WorldState types), `remotion/src/theme.ts` (deterministic style_tokens→palette), `remotion/src/compositions/{Wide,Medium,CloseUp}Shot.tsx`, updated `remotion/src/Root.tsx` (dynamic duration via `calculateMetadata`) | `npm run render:all` → 4/4 MP4s rendered; `ffprobe` confirmed each has correct duration matching its sample `shot.duration_s` (wide=4.05s, medium/closeup/title=3.05s); confirmed visually distinct content per composition via Remotion Studio (get_page_text on each route) | 2026-08-10 |
| REMOTION-001 | Remotion project scaffold + first composition | VERIFIED | `remotion/` (top-level dir per ADR-009) — `src/index.ts`, `src/Root.tsx`, `src/TitleCard.tsx` (uses `useCurrentFrame`, `spring`, `interpolate` per FR-5) | Ran `npx remotion render TitleCard out/test.mp4` → 90/90 frames encoded, 226 kB. `ffprobe` confirms valid h264, 1920x1080, 30fps, 3.05s. Also loaded Remotion Studio in-browser: composition renders correctly, zero console errors | 2026-08-10 |
| FRONTEND-001 | Vite/React/Tailwind/shadcn-ui scaffold | VERIFIED | `frontend/` — Vite React-TS template + Tailwind v4 (`@tailwindcss/vite`) + shadcn/ui (Nova preset, Radix base); `frontend/src/App.tsx` renders a real shadcn `Button` | Ran dev server via Browser preview at localhost:5173; `get_page_text`/`read_page` confirmed rendered content; zero console errors; network tab confirmed 200s for `index.css`, `button.tsx`, `radix-ui`, `class-variance-authority`, `tailwind-merge` | 2026-08-10 |

This is not an application feature — it's repository scaffolding. The table stays otherwise empty until real functionality lands; do not pre-fill it with "expected" features.

---

## 3. In Progress

**Nothing is in progress.** No task has been started.

(Template for future entries, once work begins:)
```text
Task ID: <e.g. SETUP-001>
Description: <from PROJECT_ARCHITECTURE.md Section 20>
Current state: <what exists so far>
Files being modified: <paths>
Dependencies: <task IDs that must complete first>
What remains: <specific remaining work>
Current blocker: <if any, else "none">
Next action: <the very next concrete step>
```

---

## 4. Not Started

Every task from `PROJECT_ARCHITECTURE.md` Section 20, i.e. **all 35 tasks**, prioritized. This list should shrink over time as tasks move to Section 3 and then Section 2 above — don't let this list and the architecture doc's roadmap silently drift apart.

### CRITICAL (blocks everything else)

**None remaining.** All CRITICAL tasks (SETUP-001/002/003, BACKEND-001, AI-001, FRONTEND-001) are complete.

### HIGH (core pipeline, needed for Minimum Viable success criterion)

| Task ID | Name | Depends on |
|---|---|---|
| INTEG-001 | Full end-to-end wiring | all of the above |
| INTEG-002 | FFmpeg post-processing pipeline | REMOTION-002, BACKEND-005 |

*(FRONTEND-002 and FRONTEND-003 moved to Section 2 — Verified.)*

### MEDIUM (Target-tier outcomes)

| Task ID | Name | Depends on |
|---|---|---|
| RAG-003 | Embed corpus, populate vector index | RAG-001 (done), RAG-002 (done) — now fully unblocked |
| AI-007 | Cinematographer agent (RAG-grounded) | AI-004, RAG-003 |
| AI-008 | Sentence-similarity intent check + retry loop | AI-007 |
| PROVIDER-001 | Select concrete Tier 1/2/3 providers | — |
| BACKEND-005 | External API adapter layer | PROVIDER-001, BACKEND-003 |
| CRITIC-001 | Critic loop implementation | BACKEND-005 or REMOTION-002 |
| EVAL-001 | Curate fixed 50-prompt test set | — |
| EVAL-002 | Run baseline (single-shot) condition | INTEG-001, EVAL-001 |
| EVAL-003 | Run multi-agent condition | INTEG-001, EVAL-001 |
| EVAL-004 | Score both conditions | EVAL-002, EVAL-003 |

### LOW (stretch / polish / final)

| Task ID | Name | Depends on |
|---|---|---|
| DOCS-001 | Final report writing | all prior phases |
| DEMO-001 | Live demonstration rehearsal | INTEG-001 |
| — | Optional: TTS narration (FR-10, stretch outcome only) | INTEG-002 |
| — | Optional: tool-augmented reference-image retrieval (stretch outcome only) | AI-007 |

**Also not started — genuinely undecided, not just unbuilt** (see `PROJECT_ARCHITECTURE.md` Section 24 for full detail): concrete provider selection for every API tier (R-8); an authentication/authorization decision (R-9); the shot→composition mapping strategy (R-11); several numeric thresholds (R-12); fail-closed error-handling policy for total-failure cases (R-13).

---

## 5. Verified Components

```text
[VERIFIED]
Git repository + base folder structure (SETUP-002)
Files:
- .git/
- .gitignore
- frontend/README.md
- backend/README.md
- ai-service/README.md
Verified by:
- code inspection (`git status`, directory listing)
Result:
PASS — `git status` succeeds (no commits yet, all files untracked);
frontend/, backend/, ai-service/ exist with placeholder READMEs only,
no actual application code.
Verified on: 2026-08-10
Verified by (agent/person): Claude (Sonnet 5)
```

```text
[VERIFIED]
Express backend scaffold (BACKEND-001)
Files:
- backend/package.json
- backend/src/app.js
- backend/src/routes/health.js
Verified by:
- manual run (`node src/app.js`) + test execution (`curl`)
Result:
PASS — server starts on port 5000 (or $PORT), logs
"Backend server listening on port 5000"; GET /api/health returns
200 {"status":"ok","service":"backend"}. Helmet, CORS, Morgan, dotenv
wired in. No DB, queue, or real routes yet — that's BACKEND-002/003/004.
Verified on: 2026-08-10
Verified by (agent/person): Claude (Sonnet 5)
```

```text
[VERIFIED]
FastAPI ai-service scaffold (AI-001)
Files:
- ai-service/main.py
- ai-service/requirements.txt
- ai-service/.venv-wsl/ (untracked, WSL2-native venv per ADR-008)
Verified by:
- manual run (`uvicorn main:app`, inside WSL2 Ubuntu) + test execution (`curl`)
Result:
PASS — server starts, logs "Application startup complete"; GET /health
returns 200 {"status":"ok","service":"ai-service"}. Runs from WSL2, not
native Windows Python, per ADR-008 (spaCy/Smart App Control blocker).
No analyzer/orchestrator/RAG logic yet — that's AI-002 onward.
Verified on: 2026-08-10
Verified by (agent/person): Claude (Sonnet 5)
```

```text
[VERIFIED]
Prompt Analyzer / FR-1 (AI-002)
Files:
- ai-service/analyzer/__init__.py
- ai-service/analyzer/pipeline.py (spaCy model load, cached via functools.lru_cache)
- ai-service/analyzer/scoring.py (5-dimension heuristic scorer; flags/suggestions;
  overall_score = equal-weight mean; 40-point flag threshold — see ADR-010)
- ai-service/analyzer/antonyms.json (36 hand-authored domain antonym pairs)
- ai-service/main.py (POST /analyze, pydantic request/response models, 422 on
  empty/whitespace/<3-char prompt)
- ai-service/tests/test_analyzer.py (9 tests: schema shape, well-formed prompt,
  missing-setting/vague-subject, vague-action, contradictory-descriptors,
  4x empty/short-prompt rejection cases)
Verified by:
- test execution (`pytest`, inside WSL2 `.venv-wsl` per ADR-008)
- manual run (`uvicorn main:app`) + external validation (`curl`)
Result:
PASS — 9/9 pytest tests pass. Live-server curl checks: (1) "the cat moves"
-> 35/100, flags=[vague_action, missing_setting, low_visual_detail]; (2) a
rich Mars-astronaut prompt (proposal-style) -> 86/100, no flags; (3)
whitespace-only prompt -> HTTP 422 with a descriptive error. Output shape
matches VidCraft_Proposal.tex Section 6.1 exactly (overall_score,
dimensions{5 keys}, flags[], suggestions[]).
Not yet done (out of scope for this task): persisting the analysis result
to the `prompts` Mongo collection, and exposing this through the Node
backend instead of hitting ai-service directly — that's BACKEND-004/INTEG-001.
Verified on: 2026-08-10
Verified by (agent/person): Claude (Sonnet 5)
```

```text
[VERIFIED]
Conversational Clarification Agent / FR-2 (AI-003)
Files:
- ai-service/config.py (dotenv loading: GROQ_API_KEY, GROQ_MODEL,
  ANALYSIS_SCORE_THRESHOLD)
- ai-service/llm/__init__.py, ai-service/llm/groq_client.py (cached Groq
  client, complete_json() JSON-mode wrapper; primary provider only per
  ADR-002 — fallback provider is AI-006's scope)
- ai-service/clarification/__init__.py, ai-service/clarification/agent.py
  (generate_questions(): <=2 questions, no-op if flags empty;
  build_brief(): merges Q&A into a brief dict + clarified_prompt, no-op
  if no questions — single-round design, no iteration loop, so
  termination is structural)
- ai-service/main.py: POST /clarify/questions, POST /clarify/resolve
  (pydantic models; 500 on missing GROQ_API_KEY, 400 on mismatched
  questions/answers length or malformed LLM output)
- ai-service/tests/test_clarification.py (7 tests, Groq client mocked via
  monkeypatch: no-flags no-op, question capping, non-string filtering,
  no-questions no-op, mismatched-length error, successful merge,
  malformed-response error)
- ai-service/.env (untracked, gitignored) now holds a real GROQ_API_KEY
  provided directly by the user for local testing
Verified by:
- test execution (`pytest`, WSL2 `.venv-wsl`, LLM mocked — no network
  calls in the test suite itself)
- manual run (`uvicorn main:app`) + external validation (`curl`) against
  the REAL Groq API (llama-3.3-70b-versatile, see ADR-011)
Result:
PASS — 17/17 pytest tests pass (9 analyzer + 7 clarification, +1 from a
prior session). Live end-to-end chain against the real API: (1) analyzed
"someone does something in a place" -> 33/100,
flags=[vague_action, missing_setting, low_visual_detail]; (2)
/clarify/questions on those flags -> 2 real, on-topic questions ("What
specific action..." / "Where exactly..."); (3) /clarify/resolve with
answers ("a chef is chopping vegetables" / "in a busy restaurant kitchen
at night") -> brief={action, setting, character} +
clarified_prompt="A chef is chopping vegetables in a busy restaurant
kitchen at night."; (4) re-ran /analyze on the clarified prompt -> 72/100,
0 flags — confirms the clarification loop actually improves FR-1 score.
Also verified: flags=[] -> /clarify/questions returns [] with zero LLM
calls; mismatched questions/answers lengths -> HTTP 400.
Not yet done (out of scope for this task): persisting brief/clarified
prompt to Mongo, exposing through the Node backend, and any frontend chat
UI — that's BACKEND-004/FRONTEND-002/INTEG-001. Fallback-provider
integration on LLM failure is AI-006's scope, not implemented here.
Verified on: 2026-08-10
Verified by (agent/person): Claude (Sonnet 5)
```

```text
[VERIFIED]
LangGraph Orchestrator: Screenwriter agent / FR-3 partial (AI-004)
Files:
- ai-service/orchestrator/state.py (OrchestratorState TypedDict, shared
  across all future graph nodes)
- ai-service/orchestrator/agents/__init__.py,
  ai-service/orchestrator/agents/screenwriter.py (run_screenwriter():
  LLM decomposes a clarified prompt into world_state + 3-5 shots;
  ScreenwriterOutputError on malformed LLM output — wrong shot count,
  missing description/camera/duration_s, non-dict world_state)
- ai-service/orchestrator/graph.py (build_graph(): real LangGraph
  StateGraph per ADR-001, one "screenwriter" node -> END;
  generate_storyboard(): compiles + invokes the graph)
- ai-service/orchestrator/__init__.py
- ai-service/main.py: POST /storyboard/generate (pydantic models, 500 on
  missing GROQ_API_KEY, 502 on malformed LLM output)
- ai-service/tests/test_orchestrator.py (5 tests, Groq client mocked via
  monkeypatch: valid storyboard shape, too-few-shots rejection, missing
  world_state rejection, shot missing camera rejection, graph
  end-to-end run)
- ai-service/requirements.txt: added langgraph (+ transitive
  langchain-core/langsmith/etc.), re-generated via pip freeze in
  .venv-wsl
Verified by:
- test execution (pytest, WSL2 .venv-wsl, LLM mocked — no network calls
  in the test suite itself)
- manual run (uvicorn main:app) + external validation (curl) against
  the REAL Groq API (llama-3.3-70b-versatile, per ADR-011)
- cross-directory integration check: fed AI-004's real output into
  backend remotionService.renderShot() (REMOTION-003) from a temporary
  Node script
Result:
PASS — 22/22 pytest tests pass (17 prior + 5 new). Live end-to-end: POST
/storyboard/generate with clarified_prompt "A chef is chopping
vegetables in a busy restaurant kitchen at night." -> real Groq call ->
valid storyboard_id "sb_71b38a31", world_state {characters: ["chef"],
setting: "busy restaurant kitchen at night", style_tokens: []}, and 3
shots each with description/camera/duration_s/pathway. Also verified
HTTP 422 on an empty clarified_prompt. Cross-pathway check: shot 1
(camera: "medium, static") passed to remotionService.renderShot() ->
correctly selected composition "MediumShot", rendered a real MP4
(211KB, confirmed via ISO Media container magic bytes — ffprobe itself
was not on this shell's PATH, a known pre-existing environment quirk,
not a defect in this task). Verification script and output MP4 were
cleaned up, not committed.
Per ADR-012, "camera" is the Screenwriter's own best-effort draft (not
RAG-grounded — that's Cinematographer, AI-007) and "pathway" is
hardcoded to "remotion" (not real routing — that's Producer/Router,
AI-005). Both are documented placeholders, not those agents'
functionality. Not yet done (out of scope for this task): persisting
the storyboard to Mongo, exposing this through the Node backend, and
the similarity-check retry loop (AI-008) — that's
BACKEND-004/INTEG-001/AI-008.
Verified on: 2026-08-10
Verified by (agent/person): Claude (Sonnet 5)
```

```text
[VERIFIED]
LangGraph Orchestrator: Producer/Router agent / FR-3 partial (AI-005)
Files:
- ai-service/orchestrator/agents/producer.py (assign_pathways(): sends
  shots + world_state to Groq in one call, gets back a per-shot pathway
  decision; ProducerOutputError on a malformed/invalid response)
- ai-service/orchestrator/graph.py: added a "producer" node
  (screenwriter -> producer -> END), overwriting the AI-004 hardcoded
  "remotion" default (ADR-012) with a real routing decision
- ai-service/orchestrator/__init__.py: exports ProducerOutputError
- ai-service/main.py: POST /storyboard/generate now also catches
  ProducerOutputError (502)
- ai-service/tests/test_orchestrator.py: 4 new tests (empty-shots
  no-op, pathway overwrite, invalid-pathway rejection, malformed-
  response rejection), plus the existing end-to-end graph test updated
  to mock both agents and assert the final shots carry
  producer-assigned pathways
Verified by:
- test execution (pytest, WSL2 .venv-wsl, LLM mocked — no network calls
  in the test suite itself)
- manual run (uvicorn main:app) + external validation (curl) against
  the REAL Groq API (llama-3.3-70b-versatile, per ADR-011)
Result:
PASS — 26/26 pytest tests pass (22 prior + 4 new). Live end-to-end: POST
/storyboard/generate with a prompt mixing an explicit photorealistic
shot ("A photorealistic shot of a chef chopping vegetables...") and two
stylized/animated shots ("a stylized animated title card...") -> real
Groq call -> shot 1 routed to "external_api", shots 2-3 routed to
"remotion" — the routing decision tracked the prompt's actual content,
not a static rule. Per ADR-013, this is the intended heuristic
(photorealism signal -> external_api, else remotion).
Not yet done / known limitation (documented in ADR-013, not silently
glossed over): a shot routed to "external_api" cannot currently be
rendered — the external API adapter layer (BACKEND-005) and concrete
Tier 1/2/3 providers (PROVIDER-001) don't exist yet. This is
forward-looking routing logic, verified as a decision, not as an actual
render. Also not yet done: persisting the storyboard to Mongo, exposing
through the Node backend (BACKEND-004/INTEG-001), and the
similarity-check retry loop (AI-008).
Verified on: 2026-08-10
Verified by (agent/person): Claude (Sonnet 5)
```

```text
[VERIFIED]
Vite/React/Tailwind/shadcn-ui frontend scaffold (FRONTEND-001)
Files:
- frontend/ (Vite React-TS template)
- frontend/vite.config.ts (Tailwind v4 plugin, "@/*" alias)
- frontend/components.json (shadcn/ui config, Nova preset, Radix base)
- frontend/src/App.tsx (renders a real shadcn Button)
- frontend/src/components/ui/button.tsx, frontend/src/lib/utils.ts
Verified by:
- manual run (dev server via Browser preview) + code inspection
Result:
PASS — dev server starts on :5173; get_page_text/read_page confirmed
"VidCraft" heading, description, and a real <button> element rendered;
zero console errors; network tab confirmed 200s for index.css,
button.tsx, radix-ui, class-variance-authority, tailwind-merge. (At the
time of this FRONTEND-001 check there were no real pages yet; FRONTEND-002
has since added the prompt/clarify/storyboard UI and FRONTEND-003 the style
configurator stage — both VERIFIED, see Section 2.)
Verified on: 2026-08-10
Verified by (agent/person): Claude (Sonnet 5)
```

```text
[VERIFIED]
Remotion Rendering Engine scaffold (REMOTION-001)
Files:
- remotion/package.json, remotion/tsconfig.json
- remotion/src/index.ts (registerRoot)
- remotion/src/Root.tsx (<Composition id="TitleCard">, 1920x1080, 30fps, 90 frames)
- remotion/src/TitleCard.tsx (uses useCurrentFrame, spring, interpolate per FR-5)
Verified by:
- test execution (`npx remotion render`) + external validation (`ffprobe`)
  + manual run (Remotion Studio in browser)
Result:
PASS — render completed 90/90 frames, encoded to remotion/out/test.mp4
(226 kB, untracked). ffprobe confirms a valid, playable file: h264,
1920x1080, 30/1 fps, duration 3.05s. Remotion Studio loads the
composition and renders it correctly with zero console errors.
This is the first task in the project to produce a real user-facing
artifact (a video) rather than only a health-check response.
Only ONE composition exists — the composition library (>=3 distinct
styles) is REMOTION-002, and the shot->composition mapping is
REMOTION-003 (still an open design question, R-11).
Gotcha recorded: TypeScript 7.x breaks @remotion/cli's bundler; this
project pins typescript@^5 in remotion/package.json. See ADR-009.
Verified on: 2026-08-10
Verified by (agent/person): Claude (Sonnet 5)
```

```text
[VERIFIED]
Remotion composition library (REMOTION-002)
Files:
- remotion/src/types.ts (Shot/WorldState types, mirrors proposal Section 6.3)
- remotion/src/theme.ts (style_tokens -> deterministic palette, for FR-7)
- remotion/src/compositions/WideShot.tsx
- remotion/src/compositions/MediumShot.tsx
- remotion/src/compositions/CloseUpShot.tsx
- remotion/src/Root.tsx (registers all 4 compositions, calculateMetadata
  for per-shot dynamic duration)
Verified by:
- test execution (`npm run render:all`) + external validation (`ffprobe`)
  + manual visual check (Remotion Studio, each of the 3 new routes)
Result:
PASS — all 4 compositions render to distinct MP4s. ffprobe confirmed
correct per-shot duration (wide=4.05s matching duration_s:4;
medium/closeup/title=3.05s matching duration_s:3) — proves
calculateMetadata is deriving duration from real shot data, not a
hardcoded composition length. Remotion Studio confirmed each
composition shows visually and textually distinct content driven by
its shot/worldState props (get_page_text on /WideShot, /MediumShot,
/CloseUpShot all showed the correct camera/description/setting text).
Composition selection is keyed on the leading word of shot.camera
("wide"/"medium"/"close-up") — this taxonomy decision makes partial
progress on open question R-11, but the actual selection function
(camera string -> component, plus fallback) is NOT built here — that's
REMOTION-003.
Verified on: 2026-08-10
Verified by (agent/person): Claude (Sonnet 5)
```

```text
[VERIFIED]
Shot -> composition mapping logic (REMOTION-003)
Files:
- remotion/render-shot.mjs (selectCompositionId + programmatic render
  via @remotion/bundler's bundle() + @remotion/renderer's renderMedia())
- backend/src/services/remotionService.js (renderShot(), execFile-based
  wrapper — array args, shell:false, props via temp JSON file, never
  interpolated into a command string)
Verified by:
- test execution: called remotionService.renderShot() from a script
  outside the remotion/ directory (proving the cross-directory child
  process invocation actually works, not just the standalone script)
  + external validation (ffprobe on both outputs)
Result:
PASS — two cases tested:
1. Matching shot (camera: "close-up, static") -> correctly selected
   CloseUpShot.
2. Deliberately unrecognized shot (camera: "aerial drone, 360 orbit",
   doesn't match wide/medium/close-up) -> fell back to MediumShot
   (the documented default) instead of throwing.
Both rendered to real, ffprobe-valid MP4s (h264, correct duration).
This resolves R-11 (previously an open, High-risk design question in
PROJECT_ARCHITECTURE.md's risk table) — now marked Resolved there.
Test artifacts (temp JSON props, output MP4s) were cleaned up after
verification, not committed.
Verified on: 2026-08-10
Verified by (agent/person): Claude (Sonnet 5)
```

```text
[VERIFIED]
MongoDB connection + Mongoose schemas (BACKEND-002)
Files:
- backend/src/config/db.js (connectDB)
- backend/src/models/Prompt.js
- backend/src/models/Storyboard.js (embeds world_state, shots[])
Verified by:
- test execution: connected to a real local MongoDB instance, created
  a Prompt and a Storyboard (with nested world_state/shots
  subdocuments), read both back, deleted them, closed the connection
Result:
PASS — mongoose.connect() succeeded (readyState=1); Prompt.create()
and Storyboard.create() both validated and persisted correctly
(including the embedded shot subdocument's enum fields); findById()
read back matched what was written exactly; connection.close()
completed cleanly with no dangling handles. Field names are
snake_case (raw_text, world_state, duration_s, ...) to match the
proposal's actual JSON examples and remotion/src/types.ts, not the
ER diagram's camelCase — see the naming note added to
PROJECT_ARCHITECTURE.md Section 10.
Verified on: 2026-08-10
Verified by (agent/person): Claude (Sonnet 5)
```

```text
[VERIFIED]
RAG Style Knowledge Base — FAISS index scaffold (RAG-001)
Files:
- ai-service/rag/__init__.py (exports VectorIndex, embed, get_model)
- ai-service/rag/embedder.py (lazy functools.lru_cache load of the real
  all-MiniLM-L6-v2 sentence-transformer; sentence_transformers imported
  inside the function so importing the rag package needs no heavy deps and
  the empty-index path loads no model; embed() returns L2-normalized
  float32 vectors so inner-product == cosine per FR-4)
- ai-service/rag/index.py (VectorIndex: FAISS IndexFlatIP + parallel JSON
  metadata sidecar; add()/search()/save()/load()/__len__; graceful empty
  and k>corpus handling; embed_fn injectable for tests; ADR-004 metadata-
  sync-to-MongoDB deferral documented in the module docstring)
- ai-service/config.py (EMBEDDING_MODEL, EMBEDDING_DIM, VECTOR_INDEX_PATH,
  RAG_TOP_K)
- ai-service/tests/test_rag.py (9 tests, deterministic injected 3-dim
  fake embedder — offline, no model download: empty-index graceful query,
  add count + empty-add no-op, cosine ranking, k-clamp, metadata/text
  carry-through, k=0, save/load round-trip, load-missing-returns-empty,
  dim-mismatch ValueError)
- ai-service/requirements.txt (regenerated via pip freeze in .venv-wsl:
  faiss-cpu 1.15.0, sentence-transformers 5.7.0, torch 2.13.0+cpu,
  transformers 5.15.0)
- .env.example / .gitignore (RAG vars added; ai-service/rag/data/ + *.faiss
  ignored as generated)
Verified by:
- test execution (pytest, WSL2 .venv-wsl, injected embedder — no network)
- live end-to-end run (temporary script, cleaned up) with the REAL
  all-MiniLM-L6-v2 model
Result:
PASS — 9/9 new tests pass, 35/35 total. Live run: empty index (dim 384)
-> search returns []; a 4-item cinematography corpus embedded; semantic
query "dark shadowy scene that feels tense and threatening" -> top hit was
the "Low-key lighting uses deep shadows and high contrast to create
tension" passage (0.383 cosine), Dutch-angle/unease second (0.341) — a
sensible semantic ranking, not a keyword match. save() then load() from a
temp path preserved all 4 vectors; "warm sunset lighting for a tender
moment" retrieved a lighting passage (0.571). Temp script + temp index
files removed after verification, not committed.
Scaffold only (acceptance criterion was exactly "empty index can be
created, queried, returns no results gracefully"). The curated corpus now
exists (RAG-002: 75 passages in ai-service/rag/corpus/), but it is not yet
embedded into a populated persisted production index (RAG-003), and there
is no Cinematographer consumer (AI-007). Per ADR-004 the MongoDB embeddings
collection (Section 10) is the eventual canonical metadata store; for the
scaffold the JSON sidecar is the interim store, deferral documented.
Verified on: 2026-08-10
Verified by (agent/person): Claude (Opus 4.8)
```

No other component in this project has been inspected, run, or tested,
because no other component has been written yet. This section exists to
prevent exactly the failure mode it is named after: a future agent
assuming something works because a document says it should. All
components above are scaffolding/infrastructure only — no feature
requirement (FR-1 through FR-12, except the now-complete FR-5 Remotion
pathway for a single hand-provided shot) has been implemented or verified.

### SETUP-001 feasibility testing results (2026-08-10)

Machine: Windows 11 Pro Education (this dev machine). Method: version checks
(`--version`) and, for Python packages, an actual `import` in a fresh venv
at `ai-service/.venv` — not just "pip install succeeded."

| Tool | Result | Notes |
|---|---|---|
| Node.js | ✅ PASS — v25.6.1 | |
| npm | ✅ PASS — v11.9.0 | |
| Python | ✅ PASS — 3.11.9 | Invoke as `python`, not `python3`, on this machine |
| pip | ✅ PASS — 24.0 | |
| Git | ✅ PASS — 2.53.0 | |
| FFmpeg | ✅ PASS — 9.0 (full build) | Was not installed; installed via `winget install Gyan.FFmpeg` this session. Added to PATH by the installer (new shells only — the shell that ran the install needs a restart to see it). |
| Ollama | ✅ PASS — 0.32.6, running, `llama3:latest` (4.7GB) already pulled | ⚠️ SUPERSEDED by ADR-015: local Ollama is NOT used. AI-006 confirmed a cold-start warm-up >120s and (running native on Windows) it's unreachable from the WSL2 ai-service anyway; the fallback LLM is a hosted OpenAI-compatible API instead. Kept here only as a feasibility record. |
| Groq API | ✅ PASS (reachability only) | `https://api.groq.com/openai/v1/models` returns HTTP 401 (reachable, auth required) — no API key configured/tested yet, that's a separate step under PROVIDER-001/SETUP-003 |
| numpy | ✅ PASS — imports cleanly in venv | |
| torch | ✅ PASS — 2.13.0+cpu, imports cleanly | CPU build; no GPU acceleration on this machine |
| opencv-python | ✅ PASS — 5.0.0, imports cleanly | |
| faiss-cpu | ✅ PASS — 1.15.0, imports cleanly | |
| sentence-transformers | ✅ PASS — 5.7.0, imports cleanly | Model download (`all-MiniLM-L6-v2`) not yet tested |
| fastapi / uvicorn | ✅ PASS — import cleanly | |
| spaCy | ✅ PASS (in WSL2 only) | Fails under native Windows Python (see resolved BLOCK-001 in Section 9); works cleanly in WSL2 Ubuntu — `en_core_web_sm` loads and correctly tokenizes/tags/extracts entities on a real prompt |

**BLOCK-001 detail:** Windows **Smart App Control** (a Code Integrity policy,
confirmed enabled: `VerifiedAndReputablePolicyState = 1` in the registry) is
blocking spaCy's compiled Cython extension files (`.pyd`) one at a time as
unsigned/unrecognized binaries. Confirmed via
`Get-WinEvent -LogName Microsoft-Windows-CodeIntegrity/Operational`:
`spacy/symbols.cp311-win_amd64.pyd` and `spacy/matcher/levenshtein...pyd`
were both blocked on successive import attempts; more of spaCy's ~dozen
compiled files likely remain unevaluated. This is scoped specifically to
spaCy — torch, numpy, opencv, faiss, and sentence-transformers (which
bundles compiled bits too) all import cleanly in the same venv, so it is
not a general "no native extensions allowed" problem.

**Resolved 2026-08-10**: user chose to run `ai-service` inside WSL2
(Ubuntu) rather than disable Smart App Control. Confirmed working end
to end — see Section 9 for the full resolution record.

When the first component is verified, use this format:
```text
[VERIFIED]
<Component name, matching PROJECT_ARCHITECTURE.md Section 6 naming>
Files:
- <path>
- <path>
Verified by:
- <"code inspection" and/or "test execution" and/or "manual run">
Result:
<PASS / FAIL, with specifics>
Verified on: <date>
Verified by (agent/person): <name>
```

---

## 6. Verification Checklist

Run through this before claiming *any* progress. Every line is currently `[ ]` because none of it has ever been true for this project.

- [x] Repository is a git repo (`git status` succeeds) — 2026-08-10
- [x] `frontend/` exists with a valid `package.json` — 2026-08-10
- [x] `backend/` exists with a valid `package.json` — 2026-08-10
- [x] `ai-service/` exists with a valid `requirements.txt` — 2026-08-10 (no `pyproject.toml`; `requirements.txt` via `pip freeze` in WSL2)
- [x] Frontend dependencies install cleanly (`npm install` / equivalent) — 2026-08-10
- [x] Backend dependencies install cleanly — 2026-08-10
- [x] AI microservice dependencies install cleanly (including `en_core_web_sm` spaCy model download) — 2026-08-10, in WSL2 per ADR-008
- [ ] `.env` configured locally from `.env.example` (Section 13 of the architecture doc) — no `.env.example` yet (SETUP-003 not started)
- [x] Backend server starts without error — 2026-08-10
- [x] AI microservice (FastAPI/Uvicorn) starts without error — 2026-08-10, in WSL2
- [x] Frontend dev server starts without error — 2026-08-10
- [x] MongoDB connects successfully — 2026-08-10 (native local Windows service, not Docker — see Section 9)
- [ ] Redis connects successfully
- [ ] At least one REST endpoint (Section 9) responds correctly
- [ ] WebSocket connection between frontend and backend established
- [x] Prompt analyzer (FR-1) returns a structured score for a real prompt — 2026-08-10 (AI-002, ai-service only — not yet reachable via the Node backend)
- [x] Clarification agent (FR-2) generates and processes at least one Q&A round — 2026-08-10 (AI-003, real Groq API, ai-service only — not yet reachable via the Node backend or a frontend chat UI)
- [~] Orchestrator (FR-3) produces a valid storyboard JSON for at least one prompt — 2026-08-10: Screenwriter + Producer/Router nodes (AI-004/AI-005) do this against a real prompt, including real per-shot pathway routing (ADR-013); partial only because Cinematographer (AI-007, RAG-grounded camera/style) doesn't exist yet — camera is still a Screenwriter placeholder per ADR-012, and external_api-routed shots can't be rendered yet (BACKEND-005/PROVIDER-001 missing)
- [~] RAG retrieval (FR-4) returns non-empty, relevant results for at least one query — 2026-08-10 (RAG-001): the retrieval mechanism is verified — a semantic query returned relevant, sensibly-ranked results from a small ad-hoc cinematography corpus using the real all-MiniLM-L6-v2 encoder. The *curated* reference corpus now exists too (RAG-002: 75 passages in `ai-service/rag/corpus/`). Partial only because that curated corpus isn't embedded into a persisted production index yet (RAG-003) and no agent consumes it (AI-007); the empty index also correctly returns [] gracefully
- [~] Remotion pathway (FR-5) renders at least one MP4 from a shot — 2026-08-10: fully wired end-to-end (REMOTION-001..003) including automatic composition selection + fallback; still partial only because the `shot`/`worldState` data used is hand-written sample data, not real output from an orchestrator (AI-004/005 don't exist yet) or a real REST request (not wired into a route — that's INTEG-001/BACKEND-004).
- [ ] External API pathway (FR-6) successfully generates at least one real video via a connected provider
- [ ] Critic loop (FR-8) triggers at least one real retry
- [ ] FFmpeg post-processing (FR-9) produces one concatenated, playable final MP4
- [ ] Frontend displays a delivered video end-to-end from a real prompt submission
- [x] Unit tests exist and pass for the prompt analyzer — 2026-08-10 (9/9, `ai-service/tests/test_analyzer.py`)
- [~] Unit/integration tests exist and pass for the orchestrator — 2026-08-10: 9/9 pass for the Screenwriter + Producer/Router nodes (`ai-service/tests/test_orchestrator.py`); no tests yet for Cinematographer since it doesn't exist
- [ ] Production/demo build succeeds (frontend build, backend start in production mode)
- [ ] Evaluation study (FR-12) has been run and produced a comparison table

---

## 7. Current Repository Reality

This section reflects **exactly** what exists on disk, checked directly, not inferred from any proposal or plan. Last checked: 2026-08-10.

### Actual folder structure
```text
fyp/
├── .git/                      (initialized 2026-08-10; pushed to
│                                https://github.com/Majid580/Vidcraft, main branch)
├── .gitignore
├── .claude/launch.json         (Browser-preview config, untracked — local tool config)
├── .env.example                 (SETUP-003, mirrors PROJECT_ARCHITECTURE.md Section 13)
├── docker-compose.yml           (local MongoDB — not the active setup on this machine, see Section 9)
├── VidCraft_Proposal.tex
├── PROJECT_ARCHITECTURE.md
├── PROJECT_PROGRESS.md
├── PROJECT_STATE.yaml
├── README.md
├── backend/
│   ├── package.json, package-lock.json
│   ├── .env                     (untracked — MONGODB_URI, PORT, etc., gitignored)
│   ├── node_modules/            (untracked)
│   └── src/
│       ├── app.js
│       ├── routes/health.js
│       ├── services/remotionService.js  (invokes remotion/render-shot.mjs)
│       ├── config/db.js          (connectDB — BACKEND-002)
│       └── models/Prompt.js, models/Storyboard.js
├── ai-service/
│   ├── main.py
│   ├── config.py                 (env loading — GROQ_API_KEY, GROQ_MODEL, ANALYSIS_SCORE_THRESHOLD, EMBEDDING_MODEL/DIM, VECTOR_INDEX_PATH, RAG_TOP_K)
│   ├── requirements.txt
│   ├── analyzer/                 (AI-002 — pipeline.py, scoring.py, antonyms.json)
│   ├── clarification/            (AI-003 — agent.py)
│   ├── llm/                      (groq_client.py — shared Groq JSON-mode wrapper)
│   ├── orchestrator/              (AI-004/005 — state.py, graph.py, agents/{screenwriter,producer}.py)
│   ├── rag/                       (RAG-001 — index.py VectorIndex (FAISS + JSON sidecar), embedder.py all-MiniLM-L6-v2; data/ generated index, gitignored)
│   ├── tests/                     (test_analyzer.py, test_clarification.py, test_orchestrator.py, test_rag.py)
│   ├── .venv/                   (untracked — native-Windows venv from SETUP-001, superseded by .venv-wsl)
│   └── .venv-wsl/                (untracked — the venv actually used to run the service, per ADR-008)
├── frontend/
│   ├── package.json, package-lock.json
│   ├── node_modules/            (untracked)
│   ├── vite.config.ts, tsconfig*.json, components.json
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── App.tsx, main.tsx, index.css
│       ├── components/ui/button.tsx
│       └── lib/utils.ts
└── remotion/                    (top-level per ADR-009)
    ├── package.json, package-lock.json, tsconfig.json
    ├── node_modules/            (untracked)
    ├── out/                     (untracked — rendered MP4s)
    ├── render-shot.mjs          (selectCompositionId + programmatic render, REMOTION-003)
    └── src/
        ├── index.ts             (registerRoot)
        ├── Root.tsx             (registers 4 <Composition>s, calculateMetadata)
        ├── types.ts             (Shot/WorldState, mirrors proposal Section 6.3)
        ├── theme.ts             (style_tokens -> deterministic palette, FR-7)
        ├── TitleCard.tsx        (generic intro/branding card)
        └── compositions/
            ├── WideShot.tsx
            ├── MediumShot.tsx
            └── CloseUpShot.tsx
```
The `xx00`..`xx05` split-file artifacts mentioned in earlier snapshots of
this section are gone — deleted 2026-08-10 before the first commit.

### Actual major files
- `VidCraft_Proposal.tex` — the FYP proposal, LaTeX source. Not compiled in this environment (no LaTeX toolchain here; use Overleaf or a local TeX distribution).
- `backend/src/app.js` — Express app: Helmet, CORS, Morgan, dotenv, one route file. Starts via `npm run dev` (nodemon) or `npm start`.
- `backend/src/config/db.js` + `backend/src/models/{Prompt,Storyboard}.js` — MongoDB connection + schemas (BACKEND-002).
- `ai-service/main.py` — FastAPI app, one health-check route. Must be run from WSL2 (`./.venv-wsl/bin/uvicorn main:app`), not native Windows Python — see ADR-008.
- `frontend/src/App.tsx` — Vite/React entry rendering a real shadcn/ui `Button`, styled with Tailwind v4.
- `remotion/src/` — four compositions (`TitleCard`, `WideShot`, `MediumShot`, `CloseUpShot`) plus `render-shot.mjs`, the programmatic render + shot→composition selection entry point (REMOTION-003).

### Actual implemented endpoints
- `GET /api/health` (backend, Express) — returns `{"status":"ok","service":"backend"}`
- `GET /health` (ai-service, FastAPI) — returns `{"status":"ok","service":"ai-service"}`
- `POST /analyze` (ai-service, FastAPI) — takes `{"prompt": string}`, returns FR-1 schema (`overall_score`, `dimensions`, `flags`, `suggestions`); 422 on empty/whitespace/<3-char input
- `POST /clarify/questions` (ai-service, FastAPI) — takes `{"prompt": string, "flags": string[], "suggestions": string[]}`, returns `{"questions": string[]}` (0-2 items, real Groq call, empty flags -> empty list with no LLM call)
- `POST /clarify/resolve` (ai-service, FastAPI) — takes `{"prompt": string, "questions": string[], "answers": string[]}`, returns `{"brief": object, "clarified_prompt": string}`; 400 on mismatched lengths or malformed LLM output, 500 if `GROQ_API_KEY` unset
- `POST /storyboard/generate` (ai-service, FastAPI) — takes `{"clarified_prompt": string}`, returns `{"storyboard_id": string, "world_state": object, "shots": object[]}` matching the FR-3 JSON shape (AI-004 Screenwriter + AI-005 Producer/Router, a real two-node LangGraph StateGraph); 500 if `GROQ_API_KEY` unset, 502 on malformed LLM output (either node), 422 on empty `clarified_prompt`

None of these are part of the Section 9 API surface (`/api/prompts`, `/api/storyboards`, etc.) — those are still `PLANNED`/`PROPOSED`, not implemented. All three are only reachable directly on the ai-service port; the Node backend doesn't proxy them yet (BACKEND-004).

### Actual models (database schemas)
`Prompt` and `Storyboard` Mongoose schemas exist (`backend/src/models/`), verified against a real local MongoDB instance (BACKEND-002). `embeddings`, `jobs`, `evaluation_runs` (Section 10.1) do not exist yet.

### Actual components (frontend/backend/AI)
Four scaffolds exist (backend, ai-service, frontend, remotion) — see Section 5 `[VERIFIED]` blocks above for exactly what was checked. The Remotion pathway (FR-5), the MongoDB layer, the prompt analyzer (FR-1), and now the clarification agent (FR-2) are functionally real; no other feature component (orchestrator, RAG, critic loop) exists yet.

### Actual dependencies (package.json / requirements.txt contents)
- `backend/package.json`: express, helmet, morgan, cors, dotenv, mongoose (+ nodemon, dev)
- `ai-service/requirements.txt`: fastapi, uvicorn[standard], spacy (+ en_core_web_sm model), pytest, groq, python-dotenv, langgraph (+ langchain-core/langsmith transitive deps, added for AI-004), faiss-cpu + sentence-transformers + torch (CPU) + transformers (added for RAG-001), and their transitive deps — generated via `pip freeze` in the WSL2 venv
- `frontend/package.json`: react, react-dom, tailwindcss v4, @tailwindcss/vite, shadcn/ui deps (radix-ui, class-variance-authority, clsx, tailwind-merge, lucide-react)
- `remotion/package.json`: remotion, react, react-dom, @remotion/cli, @remotion/bundler, @remotion/renderer, typescript (pinned `^5` — see ADR-009's TS 7.x gotcha note)

### Actual configuration
`.env.example` exists at repo root (SETUP-003), mirrors `PROJECT_ARCHITECTURE.md` Section 13, now also lists `GROQ_MODEL` (added in AI-003, see ADR-011). `backend/.env` exists locally (untracked, gitignored — confirmed via `git check-ignore`) with `MONGODB_URI`, `PORT`, `NODE_ENV`, `AI_SERVICE_URL` set. `ai-service/.env` now also exists locally (untracked, gitignored — confirmed via `git check-ignore`) with a real `GROQ_API_KEY` (provided directly by the user for local dev/testing, never committed), `GROQ_MODEL`, `ANALYSIS_SCORE_THRESHOLD`. `remotion/` doesn't need `.env` yet.

### Actual scripts
- Backend: `npm start` (`node src/app.js`), `npm run dev` (`nodemon src/app.js`)
- Frontend: standard Vite scripts (`npm run dev`, `build`, etc.)
- Remotion: `npm start` (Remotion Studio), `npm run render:all` (renders all 4 compositions → `out/`)
- AI microservice: no script wrapper yet, run directly via `uvicorn main:app` inside WSL2
- No CI configuration.

**Instruction to future agents:** re-run this check (list the repository, don't trust this cached snapshot) any time more than a trivial amount of time has passed, and update this section to match reality every time the project structure changes significantly.

---

## 8. Recent Changes

```text
2026-08-10 (session 1)
- Reviewed and iteratively refined VidCraft_Proposal.tex (LaTeX FYP proposal) across
  multiple sessions: added agentic/RAG architecture, hedged overclaims, fixed
  page-break formatting, corrected budget arithmetic and cross-references.
- User confirmed satisfaction with the current proposal version.
- Created the documentation/tracking system:
  - PROJECT_ARCHITECTURE.md (technical blueprint, derived from the proposal)
  - PROJECT_PROGRESS.md (this file)
  - PROJECT_STATE.yaml (machine-readable mirror)
  - README.md (repo orientation pointer)
- No application code was written in this session. Repository remains at
  Day Zero / pre-development.

2026-08-10 (session 2)
- Completed SETUP-002: ran `git init`, added `.gitignore`, created
  frontend/, backend/, ai-service/ with placeholder READMEs.
- No commits made yet — all files remain untracked pending user decision
  on an initial commit.
- Noted unexplained xx00..xx05 files in the repo root (appear to be
  split-file artifacts of PROJECT_PROGRESS.md from an external `split`
  command, not created by this session) — left in place, not investigated
  further.
- Updated this file and PROJECT_STATE.yaml to reflect SETUP-002 as
  VERIFIED (1/35 tasks complete).

2026-08-10 (session 3)
- Linked local repo to remote https://github.com/Majid580/Vidcraft,
  made the initial commit, pushed to `main`.
- Completed SETUP-001: ran version checks and Python import smoke tests
  for the full Section 5 tech stack. Installed FFmpeg (was missing) via
  `winget install Gyan.FFmpeg`. Set up `ai-service/.venv` and installed
  spacy, sentence-transformers, faiss-cpu, opencv-python, fastapi,
  uvicorn, torch (all via pip).
- Found BLOCK-001: Windows Smart App Control blocks spaCy's compiled
  .pyd files at import time. All other Python packages tested import
  cleanly. User chose to resolve via WSL2 rather than disabling Smart
  App Control. User ran `sudo apt install python3-venv python3-pip` in
  WSL (required a password, which the agent cannot supply). Agent then
  created `ai-service/.venv-wsl`, installed spaCy + en_core_web_sm
  there, and verified with a real-sentence smoke test — resolved
  same session. Recorded as ADR-008 in PROJECT_ARCHITECTURE.md.
- Committed and pushed the SETUP-001 findings + ADR-008 to GitHub.
- Updated this file and PROJECT_STATE.yaml to reflect SETUP-001 as
  VERIFIED (2/35 tasks complete).

2026-08-10 (session 4)
- Scaffolded all three main applications:
  - BACKEND-001: Express app (`backend/src/app.js`) with Helmet/CORS/
    Morgan/dotenv and a health-check route. Verified: server starts,
    GET /api/health → 200.
  - AI-001: FastAPI app (`ai-service/main.py`), run from WSL2's
    `.venv-wsl` per ADR-008. Verified: server starts, GET /health → 200.
  - FRONTEND-001: Vite + React-TS + Tailwind v4 + shadcn/ui (Nova
    preset, Radix base). Replaced the default Vite boilerplate in
    App.tsx with a minimal branded page using a real shadcn Button, to
    prove the whole stack (not just that packages installed). Verified
    in-browser via the Browser preview tool: rendered content correct,
    zero console errors, all Tailwind/shadcn network requests 200.
  - Created `.claude/launch.json` (untracked) to support browser-preview
    verification of the frontend dev server.
- Updated this file and PROJECT_STATE.yaml to reflect all three tasks
  as VERIFIED (5/35 tasks complete).
- Committed and pushed all three scaffolds to GitHub.

2026-08-10 (session 5)
- Completed REMOTION-001: scaffolded a Remotion project in a new
  top-level remotion/ directory, with one composition (TitleCard) using
  useCurrentFrame/spring/interpolate per FR-5.
- Resolved the long-standing "where does Remotion live" TBD as ADR-009
  (top-level remotion/, not nested under ai-service/) — the Python vs
  Node toolchain split made this the clear answer.
- Hit and fixed a real environment issue: TypeScript 7.x (npm's current
  default) breaks @remotion/cli's esbuild-loader with
  "Cannot read properties of undefined (reading 'readFile')". Pinned
  typescript@^5 in remotion/package.json. Recorded in ADR-009 so a
  future session doesn't rediscover it.
- Verified with a real render: 90/90 frames → out/test.mp4, then
  independently validated with ffprobe (h264, 1920x1080, 30fps, 3.05s),
  plus a visual check in Remotion Studio via browser preview.
- Added a remotion-studio entry to .claude/launch.json (untracked).
- Updated this file and PROJECT_STATE.yaml (6/35 tasks complete).

2026-08-10 (session 6)
- Completed REMOTION-002: built a real composition library.
  - remotion/src/types.ts: Shot/WorldState types mirroring the proposal's
    Section 6.3 storyboard JSON example exactly (not invented fields).
  - remotion/src/theme.ts: deterministic style_tokens -> palette mapping
    (same style_tokens always produce the same look), making FR-7
    continuity visible on screen rather than just claimed in docs.
  - Three new compositions (WideShot, MediumShot, CloseUpShot), each
    keyed to a shot "type" derived from shot.camera's leading word —
    this taxonomy decision makes partial progress on R-11 (recorded in
    PROJECT_ARCHITECTURE.md's risk table and as a note in ADR context;
    the selection function itself is still REMOTION-003).
  - Root.tsx now uses calculateMetadata so each composition's rendered
    duration comes from shot.duration_s, not a hardcoded frame count —
    verified wide (duration_s:4) rendered as 4.05s, medium/closeup
    (duration_s:3) as 3.05s.
- Verified via `npm run render:all` (4/4 MP4s) + ffprobe + Remotion
  Studio visual/text check on each new route.
- Updated PROJECT_ARCHITECTURE.md: Section 6.5 status NOT_IMPLEMENTED ->
  IN_PROGRESS, R-11 risk-table row updated (High -> Medium, partially
  resolved).
- Updated this file and PROJECT_STATE.yaml (7/35 tasks complete).

2026-08-10 (session 7)
- Completed REMOTION-003: implemented the actual shot->composition
  selection function (was only a taxonomy decision until now).
  - remotion/render-shot.mjs: selectCompositionId(shot) + a standalone
    render entry point using @remotion/bundler + @remotion/renderer's
    programmatic API directly (not the CLI) — chosen so shot text never
    touches a shell command string (props travel via a temp JSON file).
  - backend/src/services/remotionService.js: renderShot(), a thin
    execFile-based wrapper (array args, shell:false) that invokes the
    above script as a child process from the backend.
  - Installed @remotion/bundler and @remotion/renderer as explicit deps
    in remotion/package.json (were already present transitively via
    @remotion/cli).
- Verified with two real renders, called from OUTSIDE remotion/ (to
  prove the cross-directory invocation, not just the standalone
  script): a taxonomy-matching shot (close-up -> CloseUpShot) and a
  deliberately unrecognized one (aerial drone -> falls back to
  MediumShot, no throw). Both ffprobe-validated as real MP4s. Test
  artifacts (temp props JSON, output MP4s) cleaned up, not committed.
- This resolves R-11 (previously an open, High-risk design question) —
  updated its risk-table row in PROJECT_ARCHITECTURE.md to Resolved.
- The Remotion pathway (REMOTION-001..003) is now functionally
  complete for a single hand-provided shot. Still missing before it's
  useful end-to-end: a real orchestrator producing real shots
  (AI-004/005) and a REST route wiring it up (BACKEND-004/INTEG-001).
- Updated this file and PROJECT_STATE.yaml (8/35 tasks complete).

2026-08-10 (session 8)
- Completed SETUP-003: .env.example created at repo root, mirroring
  PROJECT_ARCHITECTURE.md Section 13 exactly (same variable list, same
  confirmed defaults for CRITIC_MAX_RETRIES/ANALYSIS_SCORE_THRESHOLD).
- Completed BACKEND-002: MongoDB connection + Mongoose schemas.
  - User asked whether their existing/production MongoDB was needed —
    answered no, and recommended against connecting a scaffold-stage
    project to a real personal database. User chose local MongoDB.
  - First attempt: local MongoDB via Docker Compose (docker-compose.yml
    added, mongo:7 image, localhost-only port binding, named volume).
    Hit BLOCK-002 (Docker Desktop's Inference component fails to start
    due to a corrupted socket file) — see Section 9 for the full
    troubleshooting record and why it was worked around rather than
    fixed.
  - Pivoted to `winget install MongoDB.Server` — installed cleanly,
    self-registered as an auto-start Windows service, listening on
    27017 within a couple minutes, zero credentials needed.
  - backend/src/config/db.js (connectDB), backend/src/models/Prompt.js,
    backend/src/models/Storyboard.js (embeds world_state/shots per the
    Section 10.2 ER diagram) — field names deliberately snake_case to
    match the proposal's actual JSON and remotion/src/types.ts, not the
    ER diagram's camelCase (documented as a naming note in
    PROJECT_ARCHITECTURE.md Section 10, since the camelCase there was
    this doc's own drafting inconsistency, not a real requirement).
  - Verified end-to-end: connected to the real local instance, created
    a Prompt + a Storyboard (with nested subdocuments), read both back,
    deleted the test docs, closed the connection cleanly.
- Updated PROJECT_ARCHITECTURE.md Section 10 status (NOT_IMPLEMENTED ->
  IN_PROGRESS) and added the snake_case naming note.
- Updated this file and PROJECT_STATE.yaml (10/35 tasks complete).

2026-08-10 (session 9)
- Completed AI-002: spaCy prompt analyzer (FR-1), the first real
  NLP/agentic functionality in the project (previously only scaffolds
  and infra existed).
  - ai-service/analyzer/pipeline.py: cached spaCy `en_core_web_sm` load.
  - ai-service/analyzer/scoring.py: 5-dimension heuristic scorer
    (subject_clarity via nsubj/nsubjpass presence + vague-pronoun
    penalty; action_specificity via a vague-verb lemma list + advmod
    bonus; environment_detail via GPE/LOC/FAC NER + locative
    prepositions + time-of-day words; visual_richness via adjective
    density; temporal_coherence via temporal-marker presence + finite
    past/present tense-mixing check), plus flags[]/suggestions[]
    generation (40-point threshold per dimension) and antonym-pair
    contradiction detection.
  - ai-service/analyzer/antonyms.json: 36 hand-authored domain-specific
    contradictory descriptor pairs (bright/dim, day/night,
    indoor/outdoor, etc.) per FR-1's "custom antonym dictionary"
    requirement.
  - Wired `POST /analyze` into ai-service/main.py (pydantic request/
    response models, 422 on empty/whitespace/<3-char prompt).
  - Adopted ADR-010 (equal-weight average scoring formula, 40-point
    flag threshold) to resolve the spaCy-formula half of open question
    R-12 — documented rather than silently hard-coded.
  - Wrote ai-service/tests/test_analyzer.py (9 tests). Ran via
    `.venv-wsl/bin/python -m pytest` inside WSL2 (per ADR-008, spaCy
    doesn't import on native Windows here) — 9/9 pass. Added pytest to
    requirements.txt (was missing).
  - Started uvicorn in WSL2, curl-verified POST /analyze against three
    real prompts: a deliberately vague one ("the cat moves" -> 35/100,
    flags=[vague_action, missing_setting, low_visual_detail]), a rich
    Mars-astronaut prompt in the proposal's style (-> 86/100, no
    flags), and a whitespace-only prompt (-> HTTP 422). Output shape
    matches VidCraft_Proposal.tex Section 6.1 exactly.
  - Scope note: does not persist the analysis result to MongoDB, and
    is not yet reachable through the Node backend — both explicitly
    out of scope for AI-002 (that's BACKEND-004/INTEG-001).
- Updated this file and PROJECT_STATE.yaml (11/35 tasks complete,
  ~31.4%). Added ADR-010. Marked R-12 partially resolved (spaCy
  formula decided; storyboard similarity threshold still open).

2026-08-10 (session 10)
- Completed AI-003: conversational clarification agent (FR-2).
  - User provided a real Groq API key directly in chat; written straight
    to the gitignored ai-service/.env (never echoed back, never
    committed) rather than left in the chat transcript as the only
    copy — confirmed with `git check-ignore -v ai-service/.env` before
    and after.
  - Queried the live Groq /models endpoint to pick a concrete model id
    (the proposal only said "Groq-hosted open-weight models," no
    specific id) — selected llama-3.3-70b-versatile, recorded as
    ADR-011. Also backfilled ADR-010 (from the AI-002 session) into
    PROJECT_ARCHITECTURE.md Section 22, which it had been missing from.
  - ai-service/config.py: dotenv-based config (GROQ_API_KEY, GROQ_MODEL,
    ANALYSIS_SCORE_THRESHOLD). Added GROQ_MODEL to root .env.example and
    PROJECT_ARCHITECTURE.md Section 13 (new env var, not previously
    documented).
  - ai-service/llm/groq_client.py: cached Groq client, complete_json()
    JSON-mode wrapper. Primary provider only — fallback-provider
    integration stays AI-006's scope, per the dependency graph.
  - ai-service/clarification/agent.py: generate_questions() (<=2
    questions, no LLM call if no flags) and build_brief() (merges Q&A
    into a brief + clarified_prompt, no LLM call if no questions) —
    single-round design, so termination is structural, not a retry cap.
  - Wired POST /clarify/questions and POST /clarify/resolve into
    ai-service/main.py.
  - ai-service/tests/test_clarification.py: 7 new tests, Groq client
    mocked via monkeypatch (no network calls in the suite). Full suite:
    17/17 pass in .venv-wsl.
  - Live-verified against the REAL Groq API end-to-end: analyzed a
    vague prompt (33/100) -> got 2 real clarifying questions -> resolved
    real answers into a brief + clarified prompt -> re-analyzed the
    clarified prompt and confirmed the score rose to 72/100 with 0
    flags, proving the FR-1 -> FR-2 -> FR-1 loop actually works, not
    just that each endpoint responds in isolation. Also verified the
    no-flags no-op path and the mismatched-length 400 error path.
  - User noted the Groq key is free-tier (30 req/min, 1,000 req/day,
    12k tok/min, 1M tok/day) and asked that future requests keep this
    in mind — saved as a memory for future sessions (affects pacing of
    live-LLM testing and the eventual 50-prompt evaluation study).
  - Updated this file and PROJECT_STATE.yaml (12/35 tasks complete,
    ~34.3%). Added ADR-011.

2026-08-10 (session 11)
- Housekeeping: AI-002 and AI-003's implementation (ai-service/analyzer/,
  clarification/, config.py, llm/, tests/, plus main.py/requirements.txt
  updates) had been verified in sessions 9-10 but never committed to
  git — working tree had six modified files and five untracked
  directories sitting on top of the last pushed commit
  (58ee43e). Committed all of it in one commit before starting new
  work, so the repository's git history matches what PROJECT_PROGRESS.md
  already claimed was done. Not yet pushed to origin (pending user
  confirmation).

2026-08-10 (session 12)
- Completed AI-004: LangGraph orchestrator, Screenwriter agent (first
  real slice of FR-3, and the first task to actually use LangGraph
  rather than just planning to, per ADR-001).
  - ai-service/orchestrator/state.py: OrchestratorState TypedDict
    (clarified_prompt, storyboard_id, world_state, shots) shared across
    every future graph node (Screenwriter now; Cinematographer/
    Producer-Router later).
  - ai-service/orchestrator/agents/screenwriter.py: run_screenwriter()
    calls the LLM to decompose a clarified prompt into world_state
    (characters, setting) + 3-5 shots (description, camera,
    duration_s), then validates the shape strictly (shot count bounds,
    required per-shot fields) and raises ScreenwriterOutputError on
    anything malformed rather than passing bad data downstream.
  - ai-service/orchestrator/graph.py: build_graph() wires a real
    LangGraph StateGraph (langgraph.graph.StateGraph) with a single
    "screenwriter" node -> END; generate_storyboard() compiles and
    invokes it. Deliberately a graph (not a plain function call) from
    the start, so AI-005 (Producer/Router) and AI-007 (Cinematographer)
    can be added as further nodes on the same graph rather than
    requiring a rewrite.
  - Adopted ADR-012: since Cinematographer/Producer-Router don't exist
    yet but the FR-3 storyboard shape needs "camera" and "pathway" per
    shot, the Screenwriter drafts a best-effort camera value and
    hardcodes pathway to "remotion" (DEFAULT_PATHWAY) — both explicitly
    documented as placeholders for AI-005/AI-007 to overwrite, not as
    those agents' actual logic.
  - Wired POST /storyboard/generate into ai-service/main.py (pydantic
    models; 500 on missing GROQ_API_KEY, 502 on malformed LLM output,
    422 on empty clarified_prompt).
  - Added langgraph to requirements.txt (installed in .venv-wsl;
    re-froze the full file via pip freeze — also picked up langgraph's
    transitive deps, e.g. langchain-core, langsmith, and downgraded
    websockets 17.0.1 -> 15.0.1 as a side effect of langgraph-sdk's
    pin, which uvicorn[standard] tolerates fine).
  - ai-service/tests/test_orchestrator.py: 5 new tests, Groq client
    mocked via monkeypatch (valid-shape build, too-few-shots rejection,
    missing-world_state rejection, shot-missing-camera rejection,
    full-graph end-to-end run). Full suite: 22/22 pass in .venv-wsl.
  - Live-verified against the REAL Groq API: POST /storyboard/generate
    with a real clarified prompt ("A chef is chopping vegetables in a
    busy restaurant kitchen at night.") returned a valid 3-shot
    storyboard matching the FR-3 shape exactly. Went one step further
    than prior sessions' verification depth: wrote a temporary Node
    script that fed that real storyboard's shot 1 directly into
    backend/src/services/remotionService.js's renderShot()
    (REMOTION-003) — it correctly selected the MediumShot composition
    from the LLM-drafted camera value ("medium, static") and rendered a
    real MP4, proving AI-004's output isn't just schema-valid but
    actually consumable by the existing Remotion pathway today. MP4
    validity was confirmed via file size + ISO Media container magic
    bytes rather than ffprobe, because ffprobe wasn't on this
    particular shell's PATH (a known pre-existing PATH-propagation
    quirk from the winget install in SETUP-001, not a new issue).
    Verification script and output MP4 were cleaned up, not committed.
  - Updated PROJECT_ARCHITECTURE.md Section 6.3 status (NOT_IMPLEMENTED
    -> IN_PROGRESS) and its Internal structure bullet; added ADR-012;
    updated the Phase 5 roadmap table row for AI-004.
  - Updated this file and PROJECT_STATE.yaml (13/35 tasks complete,
    ~37.1%).
  - Pushed both this session's commit and the prior session's (AI-002/
    AI-003) commit to origin/main, with explicit user confirmation
    first (58ee43e..850b74a).

2026-08-10 (session 13)
- Completed AI-005: LangGraph orchestrator, Producer/Router agent
  (extends FR-3 further; the graph now has two real nodes instead of
  one).
  - ai-service/orchestrator/agents/producer.py: assign_pathways() sends
    the Screenwriter's shots + world_state to Groq in a single call and
    gets back a per-shot pathway decision; ProducerOutputError on a
    malformed or invalid (not "remotion"/"external_api") response.
  - ai-service/orchestrator/graph.py: added a "producer" node
    (screenwriter -> producer -> END) to the existing StateGraph, per
    ADR-001 — not a second pipeline.
  - Adopted ADR-013: the routing heuristic is an LLM classification —
    does the shot's description or the storyboard's style_tokens
    explicitly call for photorealistic/live-action output? If yes,
    external_api; otherwise remotion. This directly implements the
    proposal's own §6.6 pathway distinction ("For photorealistic
    output... external API"), rather than inventing an unrelated rule.
    Explicitly documented consequence: shots routed to external_api
    can't actually be rendered yet, since the adapter layer
    (BACKEND-005) and concrete providers (PROVIDER-001) don't exist —
    this is forward-looking routing logic only, not a working
    generation path.
  - ai-service/tests/test_orchestrator.py: 4 new tests (empty-shots
    no-op with zero LLM calls, pathway overwrite preserves other shot
    fields, invalid-pathway-string rejection, malformed-response
    rejection), plus updated the existing graph end-to-end test to mock
    both agents. Full suite: 26/26 pass in .venv-wsl.
  - Live-verified against the REAL Groq API with a prompt deliberately
    mixing signals — one explicitly "photorealistic" shot and two
    explicitly "stylized animated" shots — and confirmed the real LLM
    call split them 1 external_api / 2 remotion, tracking actual prompt
    content rather than following a static per-position rule. This is a
    stronger check than merely "the endpoint returns 200."
  - Updated PROJECT_ARCHITECTURE.md Section 6.3 status/Internal
    structure (Producer/Router now IMPLEMENTED); added ADR-013; updated
    the Phase 5 roadmap table row for AI-005.
  - Updated this file and PROJECT_STATE.yaml (14/35 tasks complete,
    ~40.0%).

2026-08-10 (session 14)
- Completed BACKEND-004: REST routes, middleware, error handler — the
  first task to actually expose AI-002/003/004/005 through the Node
  backend instead of hitting ai-service directly on its own port.
  - backend/src/middleware/errorHandler.js: ApiError class (statusCode
    + message), notFoundHandler (404 for unmatched routes), and a
    centralized errorHandler that also maps Mongoose CastError (bad
    ObjectId) and ValidationError to 400 rather than leaking a raw 500.
  - backend/src/middleware/validation.js: requireFields() — a small
    hand-rolled required-field checker (no validation library added,
    consistent with the project's not-adding-deps-it-doesn't-need
    posture).
  - backend/src/services/aiServiceClient.js: HTTP client to ai-service
    using Node's built-in fetch (Node 25 on this machine, well past the
    Node 18 fetch baseline) rather than adding axios/node-fetch as a
    dependency. Maps ai-service's 422 (its own input validation) to
    400, everything else non-OK or unreachable to 502.
  - backend/src/routes/prompts.js: POST /api/prompts (real spaCy
    analysis via ai-service, persists a Prompt, returns clarification
    questions only when analysis.flags is non-empty) and POST
    /api/prompts/:id/clarify (merges answers into a clarified_text via
    ai-service's real Groq call, persists it).
  - backend/src/routes/storyboards.js: POST /api/storyboards (runs the
    real LangGraph orchestrator against a prompt's clarified_text,
    falling back to raw_text if never clarified; persists a Storyboard)
    and GET /api/storyboards/:id.
  - backend/src/app.js: now calls connectDB() before app.listen() (it
    previously never connected to Mongo at startup at all, despite
    BACKEND-002 existing); mounts the new routers under /api; adds
    notFoundHandler + errorHandler as the final middleware in the
    chain, per the standard Express ordering.
  - Adopted ADR-014: POST /api/storyboards is synchronous (201 with the
    completed storyboard), not the Section 9.2 PROPOSED async shape
    (202/"processing") — because BACKEND-003's queue doesn't exist yet,
    and faking a "processing" status for a call that already finished
    would be dishonest scaffolding rather than an honest gap. Revisit
    once BACKEND-003 lands.
  - Live-verified end-to-end with curl against a running backend (port
    5000, connected to a real local MongoDB) and a running ai-service
    (WSL2, port 8000): the full chain (analyze -> clarify -> generate
    storyboard -> fetch it back) round-tripped with real Groq/spaCy
    output at every step, not mocked data. Also verified 400 (missing
    required field), 404 (valid-but-unknown id, and an unmatched
    route), and 400 (malformed ObjectId via the CastError mapping).
    Test documents deleted from MongoDB after verification.
  - No automated test suite added for the backend (package.json's
    "test" script is still the default stub) — verification here was
    live HTTP calls only, not unit/integration tests. Worth flagging as
    a gap if a future session has time, though it wasn't a stated
    acceptance criterion for this task.
  - Mid-session note: a pre-existing ai-service process (already
    running before this session started, not started by this session)
    stopped responding after a /clarify/resolve call; restarting it
    fresh in WSL2 immediately handled the same request with no changes
    needed to the code. See Section 9 below — not treated as a new
    Blockers-table entry since it wasn't reproduced or diagnosed, just
    noted in case it recurs.
  - Updated this file and PROJECT_STATE.yaml (15/35 tasks complete,
    ~42.9%). Updated PROJECT_ARCHITECTURE.md Section 8 (file tree +
    responsibilities table) and Section 9 (Prompts/Storyboards
    endpoints PROPOSED -> IMPLEMENTED, with the ADR-014 deviation noted
    inline for POST /api/storyboards).

2026-08-10 (session 15)
- Completed BACKEND-003: Redis + Bull.js queue scaffold.
  - Installed `bull` (backend/package.json). Its dependency tree pulls
    in `uuid` <11.1.1, which has a moderate-severity advisory
    (GHSA-w5hq-g745-h8pq, a buffer-bounds-check edge case). The only
    fix path `npm audit` offers is a breaking downgrade to bull@1.1.3
    (a years-old major version) — not worth taking for a scaffold with
    no real job payloads yet; accepted as-is, noted in
    PROJECT_STATE.yaml.
  - backend/src/queues/generationQueue.js: a Bull queue named
    "generation" connected to REDIS_URL, with a placeholder processor
    that just echoes job.data back. Deliberately minimal — a real
    per-shot generation job (Remotion vs external API dispatch) isn't
    wired in here; that's INTEG-001's job once BACKEND-005 exists too.
  - Redis itself: Docker is still broken on this machine (BLOCK-002,
    unresolved at the OS level), so rather than re-attempting that,
    Redis was installed the same way ai-service already runs — inside
    WSL2 (`sudo apt install redis-server`). Sudo needs an interactive
    password this session can't supply, so the user ran the install
    command directly (identical pattern to ADR-008's spaCy/WSL2
    resolution in an earlier session). Confirmed Redis responds to
    PING inside WSL2 and that Windows can reach it at
    redis://localhost:6379 via WSL2's port forwarding
    (`Test-NetConnection`, `TcpTestSucceeded: True`) — no extra
    Windows-side configuration needed.
  - Updated .env.example and backend/.env: REDIS_URL is now a real,
    documented default (redis://localhost:6379) instead of the empty
    placeholder BACKEND-002 had left for BACKEND-003 to fill in.
  - Verified with a temporary script (backend/verify-queue-tmp.js, not
    committed): enqueued one job, awaited job.finished(), confirmed the
    processor's echoed payload matched exactly, closed the queue
    connection cleanly, deleted the script. Matches this task's
    acceptance criterion verbatim ("a trivial job can be enqueued and
    processed").
  - Updated this file, PROJECT_STATE.yaml (16/35 tasks complete,
    ~45.7%), and PROJECT_ARCHITECTURE.md Section 8 (queues row: Bull.js
    scaffold IN_PROGRESS — the file tree entry note explains the gap is
    the missing real job type, not the queue mechanism itself).
```

---

## 9. Current Blockers

| Problem | Cause | Impact | Attempted solutions | Next action |
|---|---|---|---|---|
| ~~BLOCK-001: spaCy fails to import on this dev machine~~ **RESOLVED 2026-08-10** | Windows Smart App Control blocks spaCy's unsigned compiled `.pyd` files (confirmed via Code Integrity event log) | Was blocking AI-002 (spaCy prompt analyzer) on Windows specifically | User chose to run ai-service inside WSL2 (Ubuntu, already installed). User ran `sudo apt install python3-venv python3-pip` in WSL. A `.venv-wsl` venv was created at `ai-service/.venv-wsl` (via `/mnt/c/...`), spaCy 3.8.15 + `en_core_web_sm` installed and verified: `nlp('A lone astronaut walks slowly across a dusty red Martian landscape at sunset.')` correctly tokenized, POS-tagged, and extracted one entity | **Decision: the `ai-service` component runs inside WSL2 Ubuntu going forward, not native Windows Python.** The Windows-native `ai-service/.venv` (torch/numpy/opencv/faiss/sentence-transformers — all of which worked natively) is superseded by `.venv-wsl` for consistency; a future session should scaffold AI-001 inside WSL2 and can remove the native `.venv` at that point. |
| ~~BLOCK-002: Docker Desktop won't start on this dev machine~~ **RESOLVED 2026-08-10 (worked around, not fixed)** | Docker Desktop's "Inference" (AI model runner) component fails to start: `initializing Inference manager: listening on unix://.../dockerInference: remove .../dockerInference: The file cannot be accessed by the system.` The `dockerInference` file is a corrupted reparse point (likely an orphaned AF_UNIX socket from an unclean shutdown) at `C:\Users\majid\AppData\Local\Docker\run\dockerInference` | Blocked the originally-chosen "local MongoDB via Docker" path for BACKEND-002 | Tried `Remove-Item -Force`, `fsutil reparsepoint query`, and a `robocopy /MIR` purge trick — all three failed with the identical underlying error (`Error 1920: The file cannot be accessed by the system`), meaning this is stuck at the OS/filesystem level, not something fixable from user-mode file operations | **Not actually fixed — worked around.** Installed MongoDB natively instead (`winget install MongoDB.Server`), which registered itself as an auto-start Windows service and required zero further setup. `docker-compose.yml` (root) is kept for other environments where Docker works normally; this machine just doesn't use it. If Docker is needed for something else later, try rebooting first — that's the standard fix for a Windows file lock/reparse-point corruption like this one, and hasn't been tried yet since it's disruptive mid-session. |

**Open decisions that will block specific later tasks if not resolved in time** (not blockers *today*, but flagged so they don't become surprise blockers later — see `PROJECT_ARCHITECTURE.md` Section 24 for full detail):
- PROVIDER-001 (which concrete API providers to use per tier) must be resolved before BACKEND-005 can start — target: during Phase 7, but researching options earlier reduces risk.
- The authentication/authorization question (R-9) should be resolved before FRONTEND work that depends on user-specific history/state, to avoid rework.

**Not a blocker, but a real constraint to plan around:** the project's Groq API key is free-tier — 30 requests/min, 1,000 requests/day, 12,000 tokens/min, 1,000,000 tokens/day. Fine for scaffold-stage testing (AI-003 used well under a dozen calls total), but AI-004/005/006 development and especially the EVAL-002/003 evaluation runs (50 prompts × 2 conditions, with the multi-agent condition issuing 1 + 2×N-shot calls per generation) should be paced/budgeted against this, not assumed unlimited.

**Observed flakiness, not reproduced/diagnosed (BACKEND-004 verification session):** a long-running ai-service uvicorn process (already up before this session started) stopped responding right after a `/clarify/resolve` call and its port listener disappeared — no traceback was captured since it wasn't this session's process. A fresh `uvicorn main:app --port 8000` restart in WSL2 immediately handled the identical request successfully, and the rest of the BACKEND-004 verification passed cleanly. If this recurs, capture the uvicorn stdout/stderr at the moment of the crash — that's the missing piece to actually diagnose it.

---

## 10. Next Recommended Actions

Ordered by priority, derived from `PROJECT_ARCHITECTURE.md` Section 21 (Dependency Graph) — these are the earliest unblocked tasks on the critical path.

```text
DONE (was NEXT 1): FRONTEND-002 — prompt input + clarification chat UI.
VERIFIED 2026-08-10 end-to-end against the live stack; see Section 2.
The prompt -> clarify -> storyboard pipeline is now clickable in-browser.

DONE (was NEXT 1 continuity): FRONTEND-003 — style configurator UI.
VERIFIED 2026-08-10 in-browser (demo mode) + clean production build; see
Section 2. A new 'Style' flow stage (Compose -> Refine -> Style ->
Storyboard) lets the user pick 3D-styled style tokens (visual style /
mood / lighting / palette / aspect ratio / custom) that flatten into a
style_tokens[] sent on POST /api/storyboards. NOTE: the backend does not
yet READ styleTokens (full wiring into world_state.style_tokens is
INTEG-001) — 'included in submission payload' criterion is met; demo mode
reflects them locally. All three Phase 3 frontend tasks now VERIFIED.

DONE (was NEXT 1): RAG-002 — curate cinematography reference corpus.
VERIFIED 2026-08-10; see Section 2. 75 license-clean original technique
passages across 8 categories in ai-service/rag/corpus/cinematography.json
+ a validating load_corpus() loader, in the exact VectorIndex.add() shape.

NEXT 1 (now fully unblocked — both deps VERIFIED):
Task ID: RAG-003
Embed corpus, populate vector index
Why:
RAG-001 (index scaffold) and RAG-002 (curated corpus) are both done, so
RAG-003 can embed the corpus and persist a production index, which is what
AI-007 (Cinematographer) then queries per shot.
Sketch:
index = VectorIndex(); index.add(load_corpus()); index.save()  # -> .faiss/.meta.json
then add the deferred MongoDB embeddings-collection sync (Section 10).
Dependencies:
RAG-001 (done), RAG-002 (done)
NOTE (ADR-015): RAG-003 may embed locally (RAG-001's sentence-transformers
+torch) for now — the user deferred the hosted-embeddings migration
(2026-08-10), to be done only if local embedding slows the machine.
See deferred follow-up below.
Acceptance criteria:
A persisted, populated FAISS index whose search() returns relevant
passages for representative shot-description queries.
```

BACKEND-003/004 and now AI-006 are VERIFIED — see Section 2. With AI-006 done, all Phase 5 HIGH tasks are complete.

**Deferred follow-up (ADR-015, performance-contingent):** RAG-001's embedder runs local `sentence-transformers`+`torch`. ADR-015 (all inference via hosted APIs) is firm for the LLM path, but the user **deferred** the embeddings migration (2026-08-10): keep local embeddings for now and shift to a hosted embeddings API only *if it measurably slows the machine*. So RAG-003 may embed locally for now — revisit only if performance degrades. (Groq has no embeddings endpoint, so a hosted move would need a separate embeddings provider.) Same applies to AI-008's similarity check.

---

## 11. Verification Instructions for Future AI Agents

Before modifying anything in this repository:

1. Read `PROJECT_ARCHITECTURE.md` in full.
2. Read this file (`PROJECT_PROGRESS.md`) in full.
3. Inspect the repository directly — list files, open the ones claimed to exist, don't take Section 7 above on faith if any meaningful time has passed since 2026-08-10.
4. Compare what these documents claim against what you actually find.
5. If you find a discrepancy, **the repository is correct and the documentation is wrong until fixed** — update Section 7 (and Section 2/4 as needed) immediately, before doing anything else.
6. Never assume a task is complete because a document says so. "Complete" requires the Section 25 Definition of Done in `PROJECT_ARCHITECTURE.md` — code inspection and/or a passing test run, recorded in Section 5 above.
7. Verify implementation yourself (read the code, run it, run its tests) before marking anything `VERIFIED`.
8. Update this file (`PROJECT_PROGRESS.md`) every time you make progress: move tasks between Sections 2/3/4, log the change in Section 8, recompute the percentage in Section 1 from actual verified-task counts.
9. Update `PROJECT_ARCHITECTURE.md` **only** when the actual architecture changes (a real design decision was made or reversed) — not for routine progress updates. That belongs here instead.
10. Never silently change an architectural decision recorded in `PROJECT_ARCHITECTURE.md` Section 22 (ADRs) — if you must change one, write a new ADR explaining why.
11. Record significant decisions (provider selections, threshold values, auth strategy) as new ADRs when made.
12. Record new blockers in Section 9 as soon as they're discovered, with enough detail that a different agent could pick up the investigation.
13. Record newly discovered technical debt or gaps in `PROJECT_ARCHITECTURE.md` Section 24 (Known Problems and Risks), following the existing table format.

*End of PROJECT_PROGRESS.md.*
