# PROJECT_PROGRESS.md — VidCraft Development State

> **Document type:** Living progress tracker (the "where development CURRENTLY stands" document).
> **Companion documents:** [`PROJECT_ARCHITECTURE.md`](PROJECT_ARCHITECTURE.md) (what the project is and how it should work — read that first if you haven't), [`PROJECT_STATE.yaml`](PROJECT_STATE.yaml) (machine-readable mirror of this file).
> **This file must be updated by every agent/developer session that changes the codebase.** `PROJECT_ARCHITECTURE.md` changes rarely (only when the actual architecture changes); this file changes constantly.
> **Golden rule:** nothing gets marked `VERIFIED` here because a document says so or because code "looks plausible." It gets marked `VERIFIED` because someone actually inspected the file(s) and/or ran the code/tests and recorded what they checked, below.

---

## 1. Current Project Status

| Field | Value |
|---|---|
| **Overall completion percentage** | **~2.9%** — computed as (verified tasks) / (total tasks in the Section 20 roadmap of `PROJECT_ARCHITECTURE.md`) = 1 / 35 |
| **Current phase** | Phase 0/1 — Research & Environment Setup (in progress) |
| **Current milestone** | None reached yet. Target: M1 "Development environment and technology feasibility confirmed" (proposal §8) |
| **Current objective** | Confirm the technology stack is runnable locally (SETUP-001), then scaffold the three main applications |
| **Overall status** | 🟡 **Repository initialized, no application code yet.** Git repo exists with base `frontend/`, `backend/`, `ai-service/` folders (placeholders only). |
| **Last updated** | 2026-08-10 |
| **Last updated by** | Claude (Sonnet 5) — completed SETUP-002 |

**Why 0% and not some nonzero "planning is progress" number:** the percentage in this file is defined as *verified implementation* progress against the roadmap, not planning/documentation progress. The proposal and this documentation system are real, substantial work — but they are inputs to development, not development itself. Do not inflate this number to make the project look further along than it is.

---

## 2. Completed Features

| ID | Feature | Status | Implementation | Verification | Date |
|---|---|---|---|---|---|
| SETUP-002 | Git repo + base folder structure | VERIFIED | `.git/`, `.gitignore`, `frontend/`, `backend/`, `ai-service/` (placeholder READMEs only) | `git status` succeeds; three top-level dirs confirmed present via file listing | 2026-08-10 |

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
| SETUP-001 | Technology feasibility testing | — |
| SETUP-003 | `.env.example` created | SETUP-002 |
| BACKEND-001 | Node.js/Express project setup | SETUP-002 |
| AI-001 | FastAPI microservice scaffold | SETUP-002 |
| FRONTEND-001 | React/Vite/Tailwind/shadcn-ui project setup | SETUP-002 |

### HIGH (core pipeline, needed for Minimum Viable success criterion)

| Task ID | Name | Depends on |
|---|---|---|
| BACKEND-002 | MongoDB connection + schema draft | BACKEND-001 |
| BACKEND-003 | Redis + Bull.js queue scaffold | BACKEND-001 |
| BACKEND-004 | REST routes, middleware, error handler | BACKEND-002 |
| RAG-001 | FAISS index scaffold | BACKEND-002 |
| AI-002 | spaCy prompt analyzer (FR-1) | AI-001 |
| AI-003 | Conversational clarification agent (FR-2) | AI-002 |
| AI-004 | LangGraph orchestrator: Screenwriter agent | AI-003 |
| AI-005 | LangGraph orchestrator: Producer/Router agent | AI-004 |
| AI-006 | Groq + fallback LLM integration | AI-004 |
| REMOTION-001 | Remotion project scaffold, first composition | SETUP-002 |
| REMOTION-002 | Composition library (≥3 distinct styles) | REMOTION-001 |
| REMOTION-003 | Shot → composition mapping logic | REMOTION-002 |
| INTEG-001 | Full end-to-end wiring | all of the above |
| INTEG-002 | FFmpeg post-processing pipeline | REMOTION-002, BACKEND-005 |
| FRONTEND-002 | Prompt input + clarification chat UI | FRONTEND-001, BACKEND-004 |
| FRONTEND-003 | Style configurator UI | FRONTEND-001 |

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

No other component in this project has been inspected, run, or tested,
because no other component has been written yet. This section exists to
prevent exactly the failure mode it is named after: a future agent
assuming something works because a document says it should.

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
- [ ] `frontend/` exists with a valid `package.json`
- [ ] `backend/` exists with a valid `package.json`
- [ ] `ai-service/` exists with a valid `requirements.txt` or `pyproject.toml`
- [ ] Frontend dependencies install cleanly (`npm install` / equivalent)
- [ ] Backend dependencies install cleanly
- [ ] AI microservice dependencies install cleanly (including `en_core_web_sm` spaCy model download)
- [ ] `.env` configured locally from `.env.example` (Section 13 of the architecture doc)
- [ ] Backend server starts without error
- [ ] AI microservice (FastAPI/Uvicorn) starts without error
- [ ] Frontend dev server starts without error
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
├── .git/                    (initialized 2026-08-10, no commits yet)
├── .gitignore                (added 2026-08-10)
├── frontend/README.md        (placeholder, added 2026-08-10)
├── backend/README.md         (placeholder, added 2026-08-10)
├── ai-service/README.md      (placeholder, added 2026-08-10)
├── VidCraft_Proposal.tex
├── PROJECT_ARCHITECTURE.md   (added 2026-08-10, documentation pass)
├── PROJECT_PROGRESS.md       (added 2026-08-10, documentation pass)
├── PROJECT_STATE.yaml        (added 2026-08-10, documentation pass)
├── README.md                 (added 2026-08-10, documentation pass)
└── xx00..xx05                 (unexplained split-file artifacts, not part of the project — origin undetermined, left in place)
```

### Actual major files
- `VidCraft_Proposal.tex` — the FYP proposal, LaTeX source. Compiles to the proposal PDF (not compiled in this environment — no LaTeX toolchain installed here; use Overleaf or a local TeX distribution).
- `frontend/README.md`, `backend/README.md`, `ai-service/README.md` — one-line placeholders only. No actual scaffolding (no `package.json`, no `requirements.txt`, no source files) exists yet.

### Actual implemented endpoints
**None.**

### Actual models (database schemas)
**None.**

### Actual components (frontend/backend/AI)
**None.**

### Actual dependencies (package.json / requirements.txt contents)
**No dependency manifest files exist.** Nothing has been installed for this project (beyond whatever generic tools already exist on the development machine, e.g. `git`, `node`, `python`, checked independently — not itself part of this project's dependency graph).

### Actual configuration
**None.** No `.env`, no config files.

### Actual scripts
**None.** No `npm run` scripts, no Python entrypoints, no CI configuration.

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
```

---

## 9. Current Blockers

| Problem | Cause | Impact | Attempted solutions | Next action |
|---|---|---|---|---|
| No blockers to *starting* development | N/A | N/A | N/A | Begin Phase 0/1 (SETUP-001..003) whenever development starts |

**Open decisions that will block specific later tasks if not resolved in time** (not blockers *today*, but flagged so they don't become surprise blockers later — see `PROJECT_ARCHITECTURE.md` Section 24 for full detail):
- PROVIDER-001 (which concrete API providers to use per tier) must be resolved before BACKEND-005 can start — target: during Phase 7, but researching options earlier reduces risk.
- The authentication/authorization question (R-9) should be resolved before FRONTEND work that depends on user-specific history/state, to avoid rework.
- The shot→Remotion-composition mapping strategy (R-11) should be resolved early in Phase 4 — it's on the critical path to the Minimum Viable success criterion.

---

## 10. Next Recommended Actions

Ordered by priority, derived from `PROJECT_ARCHITECTURE.md` Section 21 (Dependency Graph) — these are the earliest unblocked tasks on the critical path.

```text
NEXT 1:
Task ID: SETUP-001
Technology feasibility testing (Groq/Ollama access, spaCy install +
en_core_web_sm download, sentence-transformers, OpenCV, FFmpeg all
runnable locally)
Why:
Confirms the technology choices in PROJECT_ARCHITECTURE.md Section 5
are actually viable on the team's development machines before any
real code is written against them.
Dependencies:
None — SETUP-002 is already done, this can start immediately.
Expected output:
A short smoke-test log/notes (not necessarily a permanent file) confirming
each tool installs and runs a trivial operation.
Acceptance criteria:
Every named tool in Section 5 of PROJECT_ARCHITECTURE.md is confirmed
runnable, or a specific TBD/blocker is recorded here in its place.

NEXT 2:
Task ID: BACKEND-001, AI-001, FRONTEND-001 (can proceed in parallel — not
blocked by SETUP-001)
Scaffold the three main applications (Express backend, FastAPI AI
microservice, React frontend)
Why:
These are the three independently-deployable components the whole
architecture is built on (PROJECT_ARCHITECTURE.md Section 3). Nothing
else can be built until each has a running "hello world."
Dependencies:
SETUP-002 (done)
Expected files:
backend/src/app.js, ai-service/main.py, frontend/src/App.tsx (or
equivalent per each stack's convention)
Acceptance criteria:
Each of the three servers starts locally without error; a trivial
health-check route/response works for backend and AI microservice.
```

After NEXT 1–2, the recommended path is **REMOTION-001..003 before PROVIDER-001/BACKEND-005** — the Remotion pathway has no dependency on an undecided external provider and is the fastest route to a genuinely working, demoable end-to-end slice (per the critical-path note in `PROJECT_ARCHITECTURE.md` Section 21).

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
