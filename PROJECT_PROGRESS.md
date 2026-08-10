# PROJECT_PROGRESS.md — VidCraft Development State

> **Document type:** Living progress tracker (the "where development CURRENTLY stands" document).
> **Companion documents:** [`PROJECT_ARCHITECTURE.md`](PROJECT_ARCHITECTURE.md) (what the project is and how it should work — read that first if you haven't), [`PROJECT_STATE.yaml`](PROJECT_STATE.yaml) (machine-readable mirror of this file).
> **This file must be updated by every agent/developer session that changes the codebase.** `PROJECT_ARCHITECTURE.md` changes rarely (only when the actual architecture changes); this file changes constantly.
> **Golden rule:** nothing gets marked `VERIFIED` here because a document says so or because code "looks plausible." It gets marked `VERIFIED` because someone actually inspected the file(s) and/or ran the code/tests and recorded what they checked, below.

---

## 1. Current Project Status

| Field | Value |
|---|---|
| **Overall completion percentage** | **~14.3%** — computed as (verified tasks) / (total tasks in the Section 20 roadmap of `PROJECT_ARCHITECTURE.md`) = 5 / 35 |
| **Current phase** | Phase 0/1 complete; entering Phase 2/3 (Backend/DB, Frontend Dev) |
| **Current milestone** | M1 "Development environment and technology feasibility confirmed" — reached 2026-08-10 |
| **Current objective** | Real functionality: MongoDB/schema (BACKEND-002), spaCy prompt analyzer (AI-002), or the Remotion pathway (REMOTION-001..003, recommended fastest demoable slice) |
| **Overall status** | 🟢 **Three app scaffolds exist and are verified working.** Express backend, FastAPI ai-service (in WSL2), and Vite/React/Tailwind/shadcn frontend all confirmed running with real requests/renders. Zero feature functionality (FR-1..FR-12) implemented yet — this is infrastructure only. |
| **Last updated** | 2026-08-10 |
| **Last updated by** | Claude (Sonnet 5) — completed BACKEND-001, AI-001, FRONTEND-001 |

**Why 0% and not some nonzero "planning is progress" number:** the percentage in this file is defined as *verified implementation* progress against the roadmap, not planning/documentation progress. The proposal and this documentation system are real, substantial work — but they are inputs to development, not development itself. Do not inflate this number to make the project look further along than it is.

---

## 2. Completed Features

| ID | Feature | Status | Implementation | Verification | Date |
|---|---|---|---|---|---|
| SETUP-002 | Git repo + base folder structure | VERIFIED | `.git/`, `.gitignore`, `frontend/`, `backend/`, `ai-service/` (placeholder READMEs only); pushed to `origin/main` at https://github.com/Majid580/Vidcraft | `git status` succeeds; three top-level dirs confirmed present via file listing; `git push` succeeded | 2026-08-10 |
| SETUP-001 | Technology feasibility testing | VERIFIED (blocker found and resolved) | See Section 5 below for the full per-tool results | Version checks + `import` smoke tests run directly on the dev machine, see Section 5 | 2026-08-10 |
| BACKEND-001 | Express app scaffold | VERIFIED | `backend/src/app.js`, `backend/src/routes/health.js` (Helmet, CORS, Morgan, dotenv wired in) | Ran `node src/app.js`, `curl localhost:5000/api/health` → 200 `{"status":"ok","service":"backend"}` | 2026-08-10 |
| AI-001 | FastAPI microservice scaffold | VERIFIED | `ai-service/main.py`, `ai-service/requirements.txt`, run via `ai-service/.venv-wsl` in WSL2 (ADR-008) | Ran `uvicorn main:app` in WSL2, `curl localhost:8000/health` → 200 `{"status":"ok","service":"ai-service"}` | 2026-08-10 |
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

| Task ID | Name | Depends on |
|---|---|---|
| SETUP-003 | `.env.example` created | SETUP-002 |

### HIGH (core pipeline, needed for Minimum Viable success criterion)

| Task ID | Name | Depends on |
|---|---|---|
| BACKEND-002 | MongoDB connection + schema draft | BACKEND-001 (done) |
| BACKEND-003 | Redis + Bull.js queue scaffold | BACKEND-001 (done) |
| BACKEND-004 | REST routes, middleware, error handler | BACKEND-002 |
| RAG-001 | FAISS index scaffold | BACKEND-002 |
| AI-002 | spaCy prompt analyzer (FR-1) | AI-001 (done) |
| AI-003 | Conversational clarification agent (FR-2) | AI-002 |
| AI-004 | LangGraph orchestrator: Screenwriter agent | AI-003 |
| AI-005 | LangGraph orchestrator: Producer/Router agent | AI-004 |
| AI-006 | Groq + fallback LLM integration | AI-004 |
| REMOTION-001 | Remotion project scaffold, first composition | SETUP-002 (done) |
| REMOTION-002 | Composition library (≥3 distinct styles) | REMOTION-001 |
| REMOTION-003 | Shot → composition mapping logic | REMOTION-002 |
| INTEG-001 | Full end-to-end wiring | all of the above |
| INTEG-002 | FFmpeg post-processing pipeline | REMOTION-002, BACKEND-005 |
| FRONTEND-002 | Prompt input + clarification chat UI | FRONTEND-001 (done), BACKEND-004 |
| FRONTEND-003 | Style configurator UI | FRONTEND-001 (done) |

### MEDIUM (Target-tier outcomes)

| Task ID | Name | Depends on |
|---|---|---|
| RAG-002 | Curate cinematography reference corpus | — |
| RAG-003 | Embed corpus, populate vector index | RAG-001, RAG-002 |
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
button.tsx, radix-ui, class-variance-authority, tailwind-merge. No real
pages/features yet — that's FRONTEND-002/003.
Verified on: 2026-08-10
Verified by (agent/person): Claude (Sonnet 5)
```

No other component in this project has been inspected, run, or tested,
because no other component has been written yet. This section exists to
prevent exactly the failure mode it is named after: a future agent
assuming something works because a document says it should. All three
components above are scaffolding/infrastructure only — no feature
requirement (FR-1 through FR-12) has been implemented or verified.

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
| Ollama | ✅ PASS — 0.32.6, running, `llama3:latest` (4.7GB) already pulled | Viable as a free local fallback/dev LLM alongside Groq |
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
- [ ] MongoDB connects successfully
- [ ] Redis connects successfully
- [ ] At least one REST endpoint (Section 9) responds correctly
- [ ] WebSocket connection between frontend and backend established
- [ ] Prompt analyzer (FR-1) returns a structured score for a real prompt
- [ ] Clarification agent (FR-2) generates and processes at least one Q&A round
- [ ] Orchestrator (FR-3) produces a valid storyboard JSON for at least one prompt
- [ ] RAG retrieval (FR-4) returns non-empty, relevant results for at least one query
- [ ] Remotion pathway (FR-5) renders at least one MP4 from a shot
- [ ] External API pathway (FR-6) successfully generates at least one real video via a connected provider
- [ ] Critic loop (FR-8) triggers at least one real retry
- [ ] FFmpeg post-processing (FR-9) produces one concatenated, playable final MP4
- [ ] Frontend displays a delivered video end-to-end from a real prompt submission
- [ ] Unit tests exist and pass for the prompt analyzer
- [ ] Unit/integration tests exist and pass for the orchestrator
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
├── VidCraft_Proposal.tex
├── PROJECT_ARCHITECTURE.md
├── PROJECT_PROGRESS.md
├── PROJECT_STATE.yaml
├── README.md
├── backend/
│   ├── package.json, package-lock.json
│   ├── node_modules/            (untracked)
│   └── src/
│       ├── app.js
│       └── routes/health.js
├── ai-service/
│   ├── main.py
│   ├── requirements.txt
│   ├── .venv/                   (untracked — native-Windows venv from SETUP-001, superseded by .venv-wsl)
│   └── .venv-wsl/                (untracked — the venv actually used to run the service, per ADR-008)
└── frontend/
    ├── package.json, package-lock.json
    ├── node_modules/            (untracked)
    ├── vite.config.ts, tsconfig*.json, components.json
    ├── index.html
    ├── public/
    └── src/
        ├── App.tsx, main.tsx, index.css
        ├── components/ui/button.tsx
        └── lib/utils.ts
```
The `xx00`..`xx05` split-file artifacts mentioned in earlier snapshots of
this section are gone — deleted 2026-08-10 before the first commit.

### Actual major files
- `VidCraft_Proposal.tex` — the FYP proposal, LaTeX source. Not compiled in this environment (no LaTeX toolchain here; use Overleaf or a local TeX distribution).
- `backend/src/app.js` — Express app: Helmet, CORS, Morgan, dotenv, one route file. Starts via `npm run dev` (nodemon) or `npm start`.
- `ai-service/main.py` — FastAPI app, one health-check route. Must be run from WSL2 (`./.venv-wsl/bin/uvicorn main:app`), not native Windows Python — see ADR-008.
- `frontend/src/App.tsx` — Vite/React entry rendering a real shadcn/ui `Button`, styled with Tailwind v4.

### Actual implemented endpoints
- `GET /api/health` (backend, Express) — returns `{"status":"ok","service":"backend"}`
- `GET /health` (ai-service, FastAPI) — returns `{"status":"ok","service":"ai-service"}`

Neither is part of the Section 9 API surface (`/api/prompts`, `/api/storyboards`, etc.) — those are still `PLANNED`/`PROPOSED`, not implemented.

### Actual models (database schemas)
**None.** No MongoDB connection or Mongoose schemas exist yet (BACKEND-002).

### Actual components (frontend/backend/AI)
Three scaffolds exist (backend, ai-service, frontend) — see Section 5 `[VERIFIED]` blocks above for exactly what was checked. No feature components (prompt analyzer, orchestrator, RAG, Remotion, critic loop) exist yet.

### Actual dependencies (package.json / requirements.txt contents)
- `backend/package.json`: express, helmet, morgan, cors, dotenv (+ nodemon, dev)
- `ai-service/requirements.txt`: fastapi, uvicorn[standard], spacy (+ en_core_web_sm model), and their transitive deps — generated via `pip freeze` in the WSL2 venv
- `frontend/package.json`: react, react-dom, tailwindcss v4, @tailwindcss/vite, shadcn/ui deps (radix-ui, class-variance-authority, clsx, tailwind-merge, lucide-react)

### Actual configuration
**None.** No `.env` or `.env.example` exists yet (SETUP-003 not started) — the backend's `PORT` falls back to a hardcoded default (5000) when unset.

### Actual scripts
- Backend: `npm start` (`node src/app.js`), `npm run dev` (`nodemon src/app.js`)
- Frontend: standard Vite scripts (`npm run dev`, `build`, etc.)
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
```

---

## 9. Current Blockers

| Problem | Cause | Impact | Attempted solutions | Next action |
|---|---|---|---|---|
| ~~BLOCK-001: spaCy fails to import on this dev machine~~ **RESOLVED 2026-08-10** | Windows Smart App Control blocks spaCy's unsigned compiled `.pyd` files (confirmed via Code Integrity event log) | Was blocking AI-002 (spaCy prompt analyzer) on Windows specifically | User chose to run ai-service inside WSL2 (Ubuntu, already installed). User ran `sudo apt install python3-venv python3-pip` in WSL. A `.venv-wsl` venv was created at `ai-service/.venv-wsl` (via `/mnt/c/...`), spaCy 3.8.15 + `en_core_web_sm` installed and verified: `nlp('A lone astronaut walks slowly across a dusty red Martian landscape at sunset.')` correctly tokenized, POS-tagged, and extracted one entity | **Decision: the `ai-service` component runs inside WSL2 Ubuntu going forward, not native Windows Python.** The Windows-native `ai-service/.venv` (torch/numpy/opencv/faiss/sentence-transformers — all of which worked natively) is superseded by `.venv-wsl` for consistency; a future session should scaffold AI-001 inside WSL2 and can remove the native `.venv` at that point. |

**Open decisions that will block specific later tasks if not resolved in time** (not blockers *today*, but flagged so they don't become surprise blockers later — see `PROJECT_ARCHITECTURE.md` Section 24 for full detail):
- PROVIDER-001 (which concrete API providers to use per tier) must be resolved before BACKEND-005 can start — target: during Phase 7, but researching options earlier reduces risk.
- The authentication/authorization question (R-9) should be resolved before FRONTEND work that depends on user-specific history/state, to avoid rework.
- The shot→Remotion-composition mapping strategy (R-11) should be resolved early in Phase 4 — it's on the critical path to the Minimum Viable success criterion.

---

## 10. Next Recommended Actions

Ordered by priority, derived from `PROJECT_ARCHITECTURE.md` Section 21 (Dependency Graph) — these are the earliest unblocked tasks on the critical path.

```text
NEXT 1 (recommended, fastest route to a demoable slice):
Task ID: REMOTION-001
Remotion project scaffold, first composition
Why:
Per the critical-path note in PROJECT_ARCHITECTURE.md Section 21, the
Remotion pathway has no dependency on an undecided external provider
(unlike PROVIDER-001/BACKEND-005) and is the fastest route to a
genuinely working, demoable end-to-end slice.
Dependencies:
SETUP-002 (done)
Expected files:
ai-service/ or a dedicated remotion/ dir (exact placement TBD per
PROJECT_ARCHITECTURE.md Section 20)
Acceptance criteria:
One composition renders a test MP4 locally.

NEXT 2 (parallel-safe, unblocks the rest of the backend):
Task ID: BACKEND-002
MongoDB connection + Mongoose schema draft
Why:
BACKEND-003/004, RAG-001 all depend on this. Needs a MongoDB instance
(local or Atlas free tier — not yet decided/tested).
Dependencies:
BACKEND-001 (done)
Expected files:
backend/src/models/
Acceptance criteria:
Schemas defined for prompts, storyboards; connection verified.

NEXT 3 (parallel-safe, the other core FR):
Task ID: AI-002
spaCy prompt analyzer (FR-1)
Why:
spaCy is now confirmed working in WSL2 (BLOCK-001 resolved, ADR-008).
This is the first real piece of agentic/NLP functionality.
Dependencies:
AI-001 (done)
Expected files:
ai-service/analyzer/pipeline.py, ai-service/analyzer/scoring.py,
ai-service/analyzer/antonyms.json
Acceptance criteria:
Returns a structured score for a real prompt (per FR-1 schema); note
the scoring formula/weights are still an open design decision
(PROJECT_ARCHITECTURE.md Section 24, R-12).

Also still open, lower urgency:
SETUP-003 (.env.example) — worth doing before BACKEND-002/AI-002 need
real config values (MONGODB_URI, GROQ_API_KEY, etc.)
```

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
