# Meeting Transcription System — Project Claude Config

## Stack
- **Backend**: FastAPI (Python) · port **8001** (8000 is taken by another project on this machine)
- **Frontend**: React + Vite + TypeScript · port **5173**
- **Transcription**: OpenAI Whisper API (default) — provider-swappable via env var
- **Summarization**: Anthropic Claude API (`claude-sonnet-4-20250514`) — Phase 3
- **Export**: python-docx (.docx download) — Phase 4

## Running Locally

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# Frontend
cd frontend
npm install
npm run dev
```

Copy `backend/.env.example` → `backend/.env` and fill in API keys before starting.

## Architecture Decisions

### Transcription Provider Interface
Every transcription backend lives in `backend/transcription/` and must extend `TranscriptionProvider` (ABC in `base.py`).
Each provider owns three pieces of config:
- `provider_name: str` — shown in SSE progress messages and UI
- `allowed_extensions: frozenset[str]` — validated before reading the file
- `compression_threshold_bytes: int` — pydub compresses to mp3 when exceeded

Current providers:
| Key | Class | Threshold |
|---|---|---|
| `whisper_api` | `WhisperApiProvider` | 24 MB (Whisper API hard cap is 25 MB) |
| `local_whisper` | `LocalWhisperProvider` | 500 MB (stub — see file for impl notes) |

To add a new provider: create a file in `backend/transcription/`, subclass `TranscriptionProvider`, add it to `_REGISTRY` in `__init__.py`, set `TRANSCRIPTION_PROVIDER=your_key` in `.env`.

### SSE Streaming on `/transcribe`
`POST /transcribe` returns `StreamingResponse` with `Content-Type: text/event-stream`.
The frontend reads it with `fetch()` + `ReadableStream` (not `EventSource`, which is GET-only).

Event schema:
```json
{ "type": "progress", "message": "..." }
{ "type": "result",   "transcript": "..." }
{ "type": "error",    "message": "...", "retryWithLocal": true }
```

### Sync Transcription in Thread Pool
`provider.transcribe()` is synchronous. The endpoint runs it via `asyncio.to_thread()` to avoid blocking the event loop.

## Phase Status
- [x] Phase 1 — Skeleton & Plumbing (FastAPI + Vite scaffold, /health, proxy)
- [x] Phase 1.5 — Provider interface + SSE streaming architecture
- [x] Phase 2 — FileUploadUI component + frontend SSE reader + ErrorBoundary
- [x] Phase 3 — /summarize endpoint + Claude integration + ResultsView
- [ ] Phase 4 — /export endpoint + python-docx Word download
- [ ] Phase 5 — Hardening, edge cases, PROCESS.md, submission polish

## File Map
```
backend/
  main.py                    # FastAPI app — /health, /provider-info, /transcribe (SSE), /summarize
  summarization.py           # SummaryService + Pydantic models (ActionItem, SummaryResponse)
  requirements.txt
  .env.example
  transcription/
    base.py                  # TranscriptionProvider ABC
    whisper_api.py           # WhisperApiProvider
    local_whisper.py         # LocalWhisperProvider (stub)
    __init__.py              # get_provider() factory

frontend/
  src/
    main.tsx
    App.tsx                  # orchestrates FileUploadUI → ResultsView flow
    vite-env.d.ts
    hooks/
      useTranscription.ts    # SSE stream reader hook
      useSummarization.ts    # POST /api/summarize hook
    components/
      FileUploadUI.tsx       # drag-and-drop + 4-state upload UI
      ResultsView.tsx        # renders all 5 summary sections
      ErrorBoundary.tsx      # React class error boundary
  vite.config.ts             # proxy /api → localhost:8001
  package.json
  index.html

README.md
PLAN.md                      # full implementation plan with phase breakdown
```

## Key Constraints
- Never hardcode port 8000 — that port belongs to another project on this machine
- Provider constraints (extensions, threshold) live on the provider, never in main.py globals
- SSE events must always be one of: `progress`, `result`, `error` — frontend depends on this
- Follow all rules in `~/.claude/CLAUDE.md` (naming, function size, no magic numbers, etc.)
