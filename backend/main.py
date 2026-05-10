import asyncio
import json
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from transcription import TranscriptionProvider, get_provider

app = FastAPI(title="Meeting Transcription API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hard cap on raw upload size before any provider-level limits are applied.
MAX_RAW_BYTES = 500 * 1024 * 1024  # 500 MB

COMPRESSION_BITRATE = "64k"


def _sse(data: dict) -> str:
    """Format a dict as a single SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


def _compress_audio(input_path: str, threshold_bytes: int) -> str:
    """
    Return a path to a compressed mp3 copy when the source exceeds threshold_bytes,
    otherwise return input_path unchanged.
    Caller is responsible for deleting the returned path when it differs from input_path.
    """
    if os.path.getsize(input_path) <= threshold_bytes:
        return input_path
    from pydub import AudioSegment  # imported lazily — pydub loads FFmpeg on import
    audio = AudioSegment.from_file(input_path)
    fd, compressed_path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    audio.export(compressed_path, format="mp3", bitrate=COMPRESSION_BITRATE)
    return compressed_path


async def _stream_transcription(file: UploadFile, provider: TranscriptionProvider, resolved_key: str):
    """
    Async generator that yields SSE-formatted strings.
    Validation and compression constraints come from the provider instance,
    not from module-level globals.
    """
    tmp_path: str | None = None
    compressed_path: str | None = None

    try:
        # Validate extension against this provider's supported formats
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in provider.allowed_extensions:
            supported = ", ".join(sorted(provider.allowed_extensions))
            yield _sse({
                "type": "error",
                "message": (
                    f"'{suffix}' is not supported by {provider.provider_name}. "
                    f"Supported formats: {supported}"
                ),
            })
            return

        yield _sse({"type": "progress", "message": "Reading file..."})
        content = await file.read()

        if len(content) > MAX_RAW_BYTES:
            max_mb = MAX_RAW_BYTES // (1024 * 1024)
            yield _sse({"type": "error", "message": f"File too large (max {max_mb} MB)."})
            return

        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        with open(tmp_path, "wb") as tmp_file:
            tmp_file.write(content)

        # Compress only if the file exceeds this provider's threshold
        yield _sse({"type": "progress", "message": "Compressing audio..."})
        compressed_path = await asyncio.to_thread(
            _compress_audio, tmp_path, provider.compression_threshold_bytes
        )

        yield _sse({"type": "progress", "message": f"Transcribing with {provider.provider_name}..."})
        transcript = await asyncio.to_thread(provider.transcribe, compressed_path)

        yield _sse({"type": "result", "transcript": transcript})

    except Exception as exc:
        fallback_key = os.getenv("FALLBACK_TRANSCRIPTION_PROVIDER")
        # Only offer retry when a *different* fallback is configured vs what this request used.
        retry_available = bool(fallback_key and fallback_key != resolved_key)
        yield _sse({"type": "error", "message": str(exc), "retryWithLocal": retry_available})

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        if compressed_path and compressed_path != tmp_path and os.path.exists(compressed_path):
            os.unlink(compressed_path)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/provider-info")
def provider_info() -> dict[str, object]:
    active = get_provider()
    fallback_key = os.getenv("FALLBACK_TRANSCRIPTION_PROVIDER")
    return {
        "provider_name": active.provider_name,
        "allowed_extensions": sorted(active.allowed_extensions),
        # None when no fallback is configured; frontend uses this for the retry call.
        "fallback_provider_key": fallback_key or None,
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    provider: str | None = Query(default=None),
) -> StreamingResponse:
    # Resolve provider once per request so the same instance handles both
    # constraint checking and the actual transcription call.
    # The optional `provider` query param lets the frontend retry with a
    # different backend (e.g. ?provider=local_whisper) without a server restart.
    # Resolve the key explicitly here so _stream_transcription knows which provider
    # was actually used (needed for accurate retryWithLocal computation).
    resolved_key = provider or os.getenv("TRANSCRIPTION_PROVIDER", "whisper_api")
    active_provider = get_provider(resolved_key)
    return StreamingResponse(
        _stream_transcription(file, active_provider, resolved_key),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # prevent Nginx from buffering SSE chunks
        },
    )
