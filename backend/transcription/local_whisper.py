from typing import Any

from .base import TranscriptionProvider

_GB = 1024 * 1024 * 1024
_MODEL_SIZE = "base"  # tiny | base | small | medium | large-v3

# Loaded once on first transcription call and reused for all subsequent calls.
# Module-level so it survives across provider instances (get_provider() creates
# a new instance per request, which would reload the model on every call otherwise).
_model: Any = None


def _get_model() -> Any:
    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise RuntimeError(
                "faster-whisper is not installed. Run: pip install faster-whisper"
            ) from exc
        _model = WhisperModel(_MODEL_SIZE, device="cpu", compute_type="int8")
    return _model


class LocalWhisperProvider(TranscriptionProvider):
    """Transcribes using a locally-running faster-whisper model (no API key required)."""

    @property
    def provider_name(self) -> str:
        return "Local Whisper"

    @property
    def allowed_extensions(self) -> frozenset[str]:
        return frozenset({
            ".mp3", ".mp4", ".wav", ".m4a",
            ".ogg", ".webm", ".flac", ".aac", ".opus",
        })

    @property
    def compression_threshold_bytes(self) -> int:
        return 500 * 1024 * 1024  # compress above 500 MB to reduce RAM pressure

    @property
    def upload_size_limit_bytes(self) -> int:
        return 2 * _GB

    @property
    def compression_target_bytes(self) -> int:
        return 490 * 1024 * 1024

    @property
    def min_compression_bitrate_kbps(self) -> int:
        return 32

    @property
    def max_compression_bitrate_kbps(self) -> int:
        return 192

    def transcribe(self, file_path: str) -> str:
        model = _get_model()
        segments, _ = model.transcribe(file_path, beam_size=5)
        return " ".join(seg.text.strip() for seg in segments)
