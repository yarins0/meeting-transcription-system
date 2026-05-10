# PLAN.md — Meeting Transcription & Summary System

## Context
A full-stack web app where users upload an audio recording (mp3/wav) of a meeting and receive
a full transcript, structured summary, participant list, decisions made, and action items.
Built for a hiring assignment with a ~5-hour time budget. Single developer, runs locally,
structured to be deploy-ready without extra refactoring.

---

## Decisions Made

- **Whisper API** (not local model) — speed over cost given 5h budget
- **Local Whisper as fallback** — triggered manually via "retry with local model" button on API failure; TranscriptionService is abstracted so swapping requires one file change
- **Sync processing** (not async/polling) — acceptable latency for expected file sizes
- **pydub compression before upload** — reduces file size before hitting Whisper's 25MB limit; needs validation during build (see Build-Time Unknowns)
- **Summary language matches transcript** — majority language detected and used throughout; mixed-language meetings summarized in the dominant language
- **Single FastAPI service** (not microservices) — YAGNI at this scale
- **Deployment target TBD** — local-first, but folder structure and env config are deploy-ready from day one

---

## Stack

FastAPI (Python) + React (Vite) + OpenAI Whisper API + Anthropic Claude API (`claude-sonnet-4-6`)

React handles UI and file upload. FastAPI exposes three endpoints: transcribe, summarize, export.
All secrets via `.env`. CORS configured for localhost in dev; env-switchable for production.

---

## System Components

| Component | Responsibility | Key Dependencies |
|---|---|---|
| `FileUploadUI` | Drag-and-drop file input; validates type (mp3/wav) and size; shows progress | react-dropzone, axios |
| `TranscriptionService` | Abstracts transcription provider; compresses audio with pydub, calls Whisper API; raises clear error on failure | openai SDK, pydub |
| `SummaryService` | Sends transcript to Claude with structured system prompt; returns parsed JSON | anthropic SDK |
| `ResultsView` | Renders all 5 output sections (transcript, summary, participants, decisions, action items) | React |
| `WordExporter` | Generates .docx from structured summary; handles RTL text for Hebrew output | python-docx |
| `ErrorBoundary` | Catches API failures; surfaces "retry with local model" button when Whisper API fails | React |

---

## System Prompt for Claude

```
You are an expert meeting analyst. You will receive a raw transcript of a meeting.
Your task is to extract structured information and return it as valid JSON only —
no markdown, no preamble, no explanation.

Return this exact structure:
{
  "language": "The dominant language of the meeting (e.g. Hebrew, English)",
  "summary": "2-3 sentence overview of what the meeting was about and its outcome",
  "participants": ["Name or role if identifiable, otherwise 'Speaker 1', 'Speaker 2'..."],
  "decisions": ["Each concrete decision made, as a clear declarative sentence"],
  "action_items": [
    {
      "task": "What needs to be done (start with a verb)",
      "owner": "Who is responsible, or 'Unassigned'",
      "due": "Deadline if mentioned, else null"
    }
  ]
}

Rules:
- Respond entirely in the dominant language of the meeting
- If speakers switch languages, use the language that dominates by word count
- If no decisions were made, return an empty array for 'decisions'
- If no action items exist, return an empty array for 'action_items'
- Preserve names exactly as spoken — do not translate proper nouns
- Every action item task must start with a verb
```

**Why it's built this way:** Strict JSON-only output eliminates parsing edge cases. Explicit schema
prevents invented structure. Language instruction handles the majority-language rule at the model
level — no post-processing needed. Empty-array rule ensures the frontend never crashes on missing
sections. Verb-led action items enforce actionability without extra logic.

---

## Implementation Phases

### Phase 1 — Skeleton & Plumbing (45 min) ✅
**Goal**: Frontend and backend running locally, talking to each other. No real functionality yet.
**Tasks**:
- [x] Vite + React scaffold; install axios, react-dropzone
- [x] FastAPI app with CORS enabled for localhost:5173
- [x] `/health` endpoint returning `{"status": "ok"}`
- [x] `.env.example` with `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` placeholders
- [x] Vite proxy config pointing `/api` to `localhost:8001`
- [x] README.md stub with run instructions

**Exit criteria**: `curl http://localhost:8001/health` returns ok; React app loads in browser.

---

### Phase 2 — Transcription Pipeline (60 min) ✅
**Goal**: Upload an audio file, get back a raw transcript. Compression and error handling included.
**Tasks**:
- [x] `POST /transcribe` endpoint: accepts `multipart/form-data`
- [x] Direct ffmpeg compression (replaced pydub) — adaptive bitrate targeting provider.compression_target_bytes
- [x] Auto-split for very long recordings — N equal segments, each transcribed and joined
- [x] File-type and file-size guard with clear error messages
- [x] Call `openai.audio.transcriptions.create`, return transcript text
- [x] `FileUploadUI` component: drag-and-drop, 4-state rendering, SSE progress reader
- [x] `ErrorBoundary`: on Whisper API failure, show error + "Retry with local model" button
- [x] `TranscriptionProvider` ABC — provider swappable in one place; all constraints on the provider class

**Validated**: mp3 files (small and 83 MB) transcribed end-to-end.
**Next validation needed**: other file types (.wav, .m4a, .mp4, .webm); verify split path works correctly across formats.

---

### Phase 3 — Summary & Structured Extraction (75 min) ✅
**Goal**: Send transcript to Claude, render all 5 structured output sections.
**Tasks**:
- [x] `POST /summarize` endpoint: accepts `{"transcript": "..."}`, calls `claude-sonnet-4-6` with structured system prompt
- [x] Parse Claude's JSON response into typed Pydantic model (`ActionItem`, `SummaryResponse`)
- [x] Return structured data from FastAPI
- [x] `ResultsView` component: language badge + 5 sections with staggered animations
- [x] Graceful empty states: "No decisions recorded", "No action items"
- [x] Auto-summarize immediately after transcription completes

**Validated**: transcript + summary flow works end-to-end with real audio.

---

### Phase 4 — Word Export (45 min) ✅
**Goal**: "Download as Word" button produces a well-formatted .docx.
**Tasks**:
- [x] `POST /export` endpoint: accepts full structured summary, returns `.docx` as file response
- [x] python-docx: heading per section, bulleted lists for participants/decisions/action items
- [x] RTL paragraph direction for Hebrew output (w:bidi on paragraphs + w:bidiVisual on table)
- [x] React: handle blob response, trigger browser download
- [x] Button disabled until summary is ready

**Validated**: Hebrew .wav meeting exported correctly — all 5 sections present, table cells RTL.

---

### Phase 4.5 — File Type Validation (before Phase 5)
**Goal**: Confirm all supported formats work before submission.
**Approach** (cheap — don't waste full Whisper tokens):
- [ ] Upload a `.wav`, `.m4a`, `.mp4`, `.webm` file each — verify they reach Whisper without format/compression errors
- [x] Trigger the split path by temporarily lowering `_COMPRESS_THRESHOLD` and `_COMPRESS_TARGET` — confirmed "Transcribing part N of M…" messages appear and transcript joins correctly
- [ ] Only run full transcription on 1–2 representative formats to validate transcript quality

---

### Phase 5 — Hardening & Submission (55 min) ✅
**Goal**: No crashes on bad input. Submission artifacts complete.
**Tasks**:
- [x] Handle edge cases: empty transcript, Claude returning malformed JSON, API timeout (120s)
- [x] File size indicator in upload UI ("Over 24 MB? Auto-compressed · 500 MB max")
- [x] Environment config is deploy-ready (no hardcoded localhost URLs, env-switchable CORS)
- [ ] PROCESS.md: planning approach, AI usage examples with actual prompts, blockers encountered, time log
- [x] README.md: complete local run instructions (clone → install → add env vars → run)
- [x] Final check: all 5 required output sections present and correct
- [x] pytest suite: 44 tests covering summarization parsing, docx export and RTL, FastAPI endpoints, compression pipeline

**Exit criteria**: A stranger can clone the repo and run it in under 5 minutes. All assignment deliverables present.

---

## Build-Time Unknowns

These are not design decisions — they are things to measure and validate while building:

- **Does Whisper accept pydub-compressed files?** ✅ Resolved — switched to direct ffmpeg compression (not pydub). Adaptive bitrate targets `compression_target_bytes`; validated with 83 MB mp3 file.
- **What's the actual latency for a 30-min recording?** ✅ Resolved — SSE streaming keeps the UI responsive throughout; progress messages shown at each stage. Timeouts set to 120s for both Whisper and Claude.
- **Does python-docx RTL work without extra configuration?** ✅ Resolved — requires explicit `w:bidi` on paragraphs and `w:bidiVisual` on tables. Implemented and validated with Hebrew .wav meeting.

---

## Out of Scope (for now)

- Real-time streaming transcription
- Speaker diarization (who said what, line by line)
- Multi-file / batch processing
- User authentication or session persistence
- Database storage of past transcriptions
- Automatic deployment (CI/CD pipeline)
