# Meeting Transcription System

Upload an audio recording of a meeting and receive a full transcript, structured summary, participant list, decisions, and action items.

## Prerequisites

- Python 3.10+
- Node.js 18+
- An OpenAI API key (Whisper transcription)
- An Anthropic API key (Claude summarization — Phase 3)
- FFmpeg on PATH — required for audio compression (files > 24 MB; ffmpeg is called directly, not via pydub). Install via:
  - **Windows**: `winget install Gyan.FFmpeg` (then restart your terminal)
  - **macOS**: `brew install ffmpeg`
  - **Linux**: `sudo apt install ffmpeg`

## Local Setup

### 1. Clone and configure environment

```bash
git clone https://github.com/yarins0/meeting-transcription-system
cd meeting-transcription-system
cp backend/.env.example backend/.env
# Edit backend/.env and fill in your API keys
```

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8001
# API running at http://localhost:8001
```

> **Windows note:** Use `python -m uvicorn` rather than bare `uvicorn` to avoid PATH issues.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
# UI running at http://localhost:5173
```

### 4. Verify

```bash
curl http://localhost:8001/health
# {"status":"ok"}

curl http://localhost:8001/provider-info
# {"provider_name":"Whisper API","allowed_extensions":[...],"fallback_provider_key":null}
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Running Tests

The backend has a pytest suite (44 tests, ~3s):

```bash
cd backend
python -m pytest tests/ -v
```

Covers: summarization parsing (empty input, markdown fence stripping, malformed JSON, wrong schema), docx export sections and RTL, FastAPI endpoints (`/health`, `/summarize`, `/export`), and compression pipeline logic (mocked ffmpeg).

## Running with Docker (backend only)

```bash
cd backend
docker build -t meeting-transcription-backend .
docker run -p 8001:8001 --env-file .env meeting-transcription-backend
```

FFmpeg is baked into the image — no PATH configuration needed.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI key for Whisper transcription |
| `ANTHROPIC_API_KEY` | Yes | Anthropic key for Claude summarization (`claude-sonnet-4-6`) |
| `TRANSCRIPTION_PROVIDER` | No | `whisper_api` (default) or `local_whisper` |
| `FALLBACK_TRANSCRIPTION_PROVIDER` | No | Provider to retry with on failure (e.g. `local_whisper`) |
| `FFMPEG_BIN` | No | Full path to FFmpeg `bin/` directory — use when ffmpeg is not on PATH |

## Stack

- **Backend**: FastAPI (Python) · port 8001
- **Frontend**: React + Vite + TypeScript · port 5173
- **Transcription**: OpenAI Whisper API (provider-swappable via env var)
- **Summarization**: Anthropic Claude API — Phase 3
- **Export**: python-docx (.docx download) — Phase 4

## Phase Status

- [x] Phase 1 — FastAPI + Vite scaffold, /health, /provider-info, SSE streaming
- [x] Phase 2 — FileUploadUI (drag-and-drop), SSE progress reader, ErrorBoundary, retry flow
- [x] Phase 3 — /summarize endpoint + Claude integration + ResultsView
- [x] Phase 4 — /export endpoint + Word download (RTL support for Hebrew)
- [x] Phase 5 — Hardening, edge cases, pytest suite (44 tests); PROCESS.md in progress
