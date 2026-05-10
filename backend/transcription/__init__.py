import os

from .base import TranscriptionProvider
from .local_whisper import LocalWhisperProvider
from .whisper_api import WhisperApiProvider

_REGISTRY: dict[str, type[TranscriptionProvider]] = {
    "whisper_api": WhisperApiProvider,
    "local_whisper": LocalWhisperProvider,
}


def get_provider(name: str | None = None) -> TranscriptionProvider:
    """
    Instantiate a transcription provider.
    Uses name if provided; otherwise reads TRANSCRIPTION_PROVIDER env var,
    defaulting to 'whisper_api'.
    """
    resolved = name or os.getenv("TRANSCRIPTION_PROVIDER", "whisper_api")
    provider_class = _REGISTRY.get(resolved)
    if provider_class is None:
        valid = ", ".join(_REGISTRY)
        raise ValueError(
            f"Unknown provider '{resolved}'. Valid options: {valid}"
        )
    return provider_class()
