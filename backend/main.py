import asyncio
import io
import json
import math
import os
import subprocess
import tempfile
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # reads backend/.env into os.environ before anything else runs

from fastapi import FastAPI, File, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from export import ExportRequest, build_docx
from summarization import SummarizeRequest, SummaryResponse, SummaryService
from transcription import TranscriptionProvider, get_provider

app = FastAPI(title="Meeting Transcription API")

_CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hard cap on raw upload size — applied before any provider-level limits.
MAX_RAW_BYTES = 500 * 1024 * 1024  # 500 MB


def _sse(data: dict) -> str:
    """Format a dict as a single SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


def _ffmpeg_bin_dir() -> str:
    return os.getenv("FFMPEG_BIN", "")


def _ffmpeg_exe() -> str:
    d = _ffmpeg_bin_dir()
    ext = ".exe" if os.name == "nt" else ""
    return os.path.join(d, f"ffmpeg{ext}") if d else "ffmpeg"


def _ffprobe_exe() -> str:
    d = _ffmpeg_bin_dir()
    ext = ".exe" if os.name == "nt" else ""
    return os.path.join(d, f"ffprobe{ext}") if d else "ffprobe"


def _audio_duration_seconds(input_path: str) -> float:
    """Return audio duration via ffprobe."""
    result = subprocess.run(
        [_ffprobe_exe(), "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", input_path],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def _target_bitrate(duration_seconds: float, provider: TranscriptionProvider) -> str:
    """Return the highest bitrate (as an ffmpeg string like '48k') that keeps
    the mono 16kHz output under the provider's compression_target_bytes."""
    kbps = int((provider.compression_target_bytes * 8) / duration_seconds / 1000)
    lo, hi = provider.min_compression_bitrate_kbps, provider.max_compression_bitrate_kbps
    return f"{max(lo, min(hi, kbps))}k"


def _compress_segment(input_path: str, start: float, duration: float, bitrate: str) -> str:
    """Encode a time-bounded slice of input_path to a new mono 16kHz mp3 temp file."""
    fd, path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    cmd = [_ffmpeg_exe(), "-i", input_path]
    if start > 0:
        cmd += ["-ss", str(start)]
    if duration > 0:
        cmd += ["-t", str(duration)]
    cmd += ["-ac", "1", "-ar", "16000", "-b:a", bitrate, "-y", path]
    subprocess.run(cmd, check=True, capture_output=True)
    return path


def _prepare_audio_segments(input_path: str, provider: TranscriptionProvider) -> list[str]:
    """
    Return a list of compressed audio paths ready for the provider.
    Returns [input_path] unchanged when the file is under the provider's threshold.
    Splits into multiple segments when the recording is too long to fit in one
    request even at minimum bitrate.
    Caller is responsible for deleting any returned paths that differ from input_path.
    """
    if os.path.getsize(input_path) <= provider.compression_threshold_bytes:
        return [input_path]

    duration = _audio_duration_seconds(input_path)
    min_kbps = provider.min_compression_bitrate_kbps

    # Maximum seconds that fit in one segment at minimum bitrate
    max_segment_secs = (provider.compression_target_bytes * 8) // (min_kbps * 1000)

    if duration <= max_segment_secs:
        return [_compress_segment(input_path, 0, 0, _target_bitrate(duration, provider))]

    n = math.ceil(duration / max_segment_secs)
    segment_duration = math.ceil(duration / n)
    return [
        _compress_segment(input_path, i * segment_duration, segment_duration, f"{min_kbps}k")
        for i in range(n)
    ]


async def _stream_transcription(file: UploadFile, provider: TranscriptionProvider, resolved_key: str):
    """
    Async generator that yields SSE-formatted strings.
    Validation and compression constraints come from the provider instance,
    not from module-level globals.
    """
    tmp_path: str | None = None
    segment_paths: list[str] = []

    try:
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

        yield _sse({"type": "progress", "message": "Preparing audio..."})
        segment_paths = await asyncio.to_thread(
            _prepare_audio_segments, tmp_path, provider
        )

        parts: list[str] = []
        for i, seg_path in enumerate(segment_paths):
            label = (
                f"Transcribing part {i + 1} of {len(segment_paths)}…"
                if len(segment_paths) > 1
                else f"Transcribing with {provider.provider_name}…"
            )
            yield _sse({"type": "progress", "message": label})
            parts.append(await asyncio.to_thread(provider.transcribe, seg_path))

        yield _sse({"type": "result", "transcript": " ".join(parts)})

    except Exception as exc:
        fallback_key = os.getenv("FALLBACK_TRANSCRIPTION_PROVIDER")
        retry_available = bool(fallback_key and fallback_key != resolved_key)
        yield _sse({"type": "error", "message": str(exc), "retryWithLocal": retry_available})

    finally:
        # Use a set to avoid double-deleting when segment_paths contains tmp_path
        # (the no-compression case). Windows FFmpeg handles: wrap in try/except OSError.
        to_delete = set(segment_paths)
        if tmp_path:
            to_delete.add(tmp_path)
        for path in to_delete:
            if os.path.exists(path):
                try:
                    os.unlink(path)
                except OSError:
                    pass


@app.post("/summarize")
async def summarize(body: SummarizeRequest) -> SummaryResponse:
    service = SummaryService()
    return await asyncio.to_thread(service.summarize, body.transcript)


@app.post("/export")
async def export_summary(body: ExportRequest) -> StreamingResponse:
    docx_bytes = await asyncio.to_thread(build_docx, body)
    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="meeting-summary.docx"'},
    )


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
