# Meeting Transcription System

Upload an audio recording of a meeting and receive a full transcript, structured summary, participant list, decisions, and action items.

## Prerequisites

- Python 3.10+
- Node.js 18+
- An OpenAI API key (Whisper transcription)
- An Anthropic API key (Claude summarization — Phase 3)
- FFmpeg on PATH (only required when uploaded files exceed 24 MB — used by pydub for compression)

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

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI key for Whisper transcription |
| `ANTHROPIC_API_KEY` | Yes (Phase 3+) | Anthropic key for Claude summarization |
| `TRANSCRIPTION_PROVIDER` | No | `whisper_api` (default) or `local_whisper` |
| `FALLBACK_TRANSCRIPTION_PROVIDER` | No | Provider to retry with on failure (e.g. `local_whisper`) |

## Stack

- **Backend**: FastAPI (Python) · port 8001
- **Frontend**: React + Vite + TypeScript · port 5173
- **Transcription**: OpenAI Whisper API (provider-swappable via env var)
- **Summarization**: Anthropic Claude API — Phase 3
- **Export**: python-docx (.docx download) — Phase 4

## Phase Status

- [x] Phase 1 — FastAPI + Vite scaffold, /health, /provider-info, SSE streaming
- [x] Phase 2 — FileUploadUI (drag-and-drop), SSE progress reader, ErrorBoundary, retry flow
- [ ] Phase 3 — /summarize endpoint + Claude integration + ResultsView
- [ ] Phase 4 — /export endpoint + Word download
- [ ] Phase 5 — Hardening, edge cases, PROCESS.md, submission polish
