# Research Phase [5 min]

At first the only tool in the tech-stack I had to research was OpenAI Whisper API and other transcription models that are also stable and provide Hebrew support (as I've found Whisper to provide).
I encountered a wide variety of models but decided to stick with the recommended one while also planning on not using an interface for model calls, which will let the code be mainly model-agnostic.
The thought is leaving room for additions — like letting the user choose the model they would like to use, or making whoever clones this project's life easier — but I won't add it in my limited 5hr window. (I didn't act in a similar way in a former project "TuneCraft" — the code was written for only one music platform and it made my life harder when I wanted to add more later.)
I also found this video that might come in handy later, but again probably won't have the time for model tuning with my time window ([Transcription Models Zero to Hero - Data Prep, Train + Serve](https://www.youtube.com/watch?v=ORnnufNjw10)).

After looking up Whisper specifically in the [OpenAI docs](https://developers.openai.com/api/docs/guides/speech-to-text), what I got is that file uploads are currently limited to 25 MB, and that I can expand the type support to mp3, mp4, mpeg, mpga, m4a, wav, and webm, and that there is a variety of output file types. Also that the supported languages include English and Hebrew, which are currently my main concerns.

---

# Planning Phase [10 min]

Prompt: `/arch-planner` — in this plan include Whisper API but use it as an interface in order to make other models accessible in the future (with the provided `assignment.pdf` added).
This is the skill description: "Act as a senior software architect to help users design, plan, and validate software systems. Use this skill whenever a user wants to brainstorm a new project, get tech stack recommendations, break a system into components, generate an implementation plan, think through edge cases and failure modes, or stress-test a plan against engineering principles (YAGNI, SOLID, DRY, KISS)".

After brainstorming with Claude I decided:

- **Whisper fallback trigger** — Use local Whisper if the API fails. Show the user an error with a "retry with local model" button: user is aware of the switch, you don't need local Whisper pre-installed.
- Use pydub library to compress files bigger than 25 MB.
- **Multi-language meetings** — Detect the dominant language, summarize entirely in that language.
- **Sync vs. async processing** — Use SSE to stream progress.

Claude also raised this flag: *What breaks first: the Word export with Hebrew text. python-docx has poor RTL support — the text appears but runs left-to-right.*
Fix: test early and add explicit RTL paragraph formatting.

---

# Execution Phase

## Phase 1 — Skeleton & Plumbing [5 min]

In a new project folder with only [`PLAN.md`](PLAN.md) in it:

- Prompt in plan mode for Claude Code: `@PLAN.md` — this project is all about this plan, read it and describe your plan before writing any code. (There are also rules in the global `CLAUDE.md` which the agent obeys.)

After presenting a solid plan, Claude started and finished Phase 1 with both servers running. Phase 1 exit criteria met:
- `GET http://localhost:8001/health` → `{"status": "ok"}`
- `GET http://localhost:5173` → HTTP 200 (React app loads)

After a code review I noticed there were global vars named `ALLOWED_EXTENSIONS` and `COMPRESSION_THRESHOLD_BYTES` in `backend/main.py`, so:

- Prompt: `each model interface should have its own ALLOWED_EXTENSIONS, COMPRESSION_THRESHOLD_BYTES`
- Prompt: `create CLAUDE.md and /handoff`

---

## Phase 2 — Transcription Pipeline [20 min]

Simply pasted the prompt given by the previous session into a new Claude Code session in planning mode; after approving the plan (which looked fine).

- Prompt: `/review` (just activated a code review for Phase 2, which actually found 2 bugs)

Later on I reviewed what was done manually and did a smoke test.

Initial commit using Claude to phrase the notes and creating `.gitignore` (double and triple checking `.env` isn't there).

- Prompt: `/handoff`

---

## Phase 3 — Summary & Structured Extraction [60 min]

Pasted the handoff prompt in plan mode while Claude thinks; I generated both API keys needed and pasted them into `.env`.

When passing a smaller file:
```
❯ Missing credentials. Please pass an `api_key`, `workload_identity`, `admin_api_key`, or
  set the `OPENAI_API_KEY` or `OPENAI_ADMIN_KEY` environment variable.
```
When putting a bigger one (82.9 MB):
```
❯ "No module named 'pyaudioop'"
```

This started a long debugging session; meanwhile I ran a purely frontend-design agent and deployed to a new branch.

After some time another error occurred that made me realise the code can't see ANY `.env` vars, so I fixed the import and now both the transcription and summary work well for files smaller than 25 MB — English meeting.

- Prompt: `/debug`

```
Error code: 413 - {'error': {'message': '413: Maximum content size limit (26214400)
  exceeded (26265624 bytes read)', 'type': 'server_error', 'param': None, 'code': None},
  'usage': {'type': 'duration', 'seconds': 0}}
```
for the big file; also got `Local Whisper provider is not yet implemented` error after hitting the "try fallback" button.

The problem was that the compression wasn't enough — the compressed file was 26 MB. Claude suggested upping the bitrate in order to get a smaller file.

- Prompt: `can we compute the minimal bit rate needed? that way we can get as close as we can to 25 MB.`
- Prompt: `This is too messy, lets try splitting the file to smaller pieces instead`

The 413 still hadn't resolved because "the mp3 encoder runs 4–5% over the target bitrate, pushing 23.8 MB theoretical → 25.1 MB actual" as Claude claims, which seems right after testing and logging the actual sizes.

The bigger 83 MB `.mp3` file worked! Time to check other file types — the test should be simple: just check if the split works fine and then if the transcription works for the first 2 parts, in order to not waste tokens.

**Summarization system prompt** — the instruction set sent to Claude on every `/summarize` call lives in [`backend/prompts.md`](backend/prompts.md). It tells the model to return structured JSON only (no markdown wrapping), respond in the meeting's dominant language, and follow specific rules for participants, decisions, and action items. To change what Claude extracts or how it formats output, edit `prompts.md` directly — no Python needed. `summarization.py` reads it at startup and passes it as the `system=` parameter unchanged.

- Prompt: `/document-release` (skill that updated the docs and pushed the code)
- Prompt: `/handoff`

---

## Phase 4 — Word Export [30 min]

Pasted the handoff prompt in plan mode and went over the plan.

After some adjustments like: "account for right to left languages", Claude started executing the plan.

While Claude builds, I tested a `.wav` file with a Hebrew meeting which got back an empty transcript from Whisper and crashed the app, then added empty response handling.
The response was full on the next attempt (didn't display right-to-left on the web, so fixed with another agent that also added `sessionStorage` use).

After checking the `.docx` file for the Hebrew `.wav` meeting:
- Prompt: `the docx file is missing the transcript section + the table content doesn't turn right to left when needed`

After those fixes the full export flow worked correctly for Hebrew `.wav` — all 5 sections in the `.docx`, table columns RTL, paragraph text RTL, transcript included.

- Prompt: `/handoff`

---

## Phase 5 — Hardening & Submission [20 min]

Pasted the handoff prompt in plan mode. Plan covered: fix the local Whisper fallback error message, write the pytest suite, test the split path live, and commit everything.

Claude wrote 44 tests across 4 files in `backend/tests/`:
- `test_summarization.py` — empty transcript guard, markdown fence stripping, malformed JSON, wrong Pydantic schema, happy path
- `test_export.py` — all sections present, RTL bidi on Hebrew/Arabic/Persian/Urdu paragraphs and table, null due date, empty collections fallback text
- `test_endpoints.py` — `/health`, `/summarize` with mocked Claude, `/export` with mocked `build_docx`, Pydantic validation errors
- `test_compression.py` — `_target_bitrate` clamping to min/max, below-threshold passthrough, single-segment and multi-segment splitting with start offset verification

All 44 tests pass in ~2.5s.

Tested the split path live: lowered `_COMPRESS_THRESHOLD` and `_COMPRESS_TARGET` in `whisper_api.py` to force splitting — confirmed "Transcribing part 1 of N…" SSE progress messages appeared in the UI and the final joined transcript was correct.

- Prompt: `update plan.md and the other docs`
- Prompt: `@PLAN.md [x] Environment config is deploy-ready (no hardcoded localhost URLs, env-switchable CORS) — is this right?` (I knew it wasn't when I wrote the prompt)

# Deploy Phase [20 min]

Checked running the demo locally with and without docker successfully.

Noticed the frontend used hardcoded `/api/...` paths everywhere.

- Prompt: `the frontend is hardcoding /api — walk me through deploying the backend to Render and frond end to Vercel`

Fix: created `frontend/src/config.ts` that exports `API_BASE`, reading from `VITE_API_BASE_URL` at build time and falling back to `/api` for local dev. All four fetch call sites (`App.tsx`, `useTranscription.ts`, `useSummarization.ts`, `useExport.ts`) updated to use it.

Also updated `backend/Dockerfile` CMD from exec-form with hardcoded `8001` to shell-form `${PORT:-8001}` so Render can inject its own `PORT` env var at runtime.

**Render setup (backend):**
- New Web Service → Docker, root directory: `backend`
- Env vars: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TRANSCRIPTION_PROVIDER=whisper_api`, `CORS_ORIGINS=<vercel-url>`

**Vercel setup (frontend):**
- New Project, root directory: `frontend`
- Env var: `VITE_API_BASE_URL=<render-service-url>`

Deploy order matters: Render first, then set its URL in Vercel before triggering the frontend build.
