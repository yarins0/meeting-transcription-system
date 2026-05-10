from .base import TranscriptionProvider

# Local model has no API size limit; compress only very large files to reduce RAM usage.
_LOCAL_COMPRESSION_THRESHOLD = 500 * 1024 * 1024  # 500 MB


class LocalWhisperProvider(TranscriptionProvider):
    """
    Stub for a locally-running Whisper model.

    To implement: install the `openai-whisper` package and replace the body of
    `transcribe()` with:

        import whisper
        model = whisper.load_model("base")   # or "small", "medium", "large"
        result = model.transcribe(file_path)
        return result["text"]

    Then set TRANSCRIPTION_PROVIDER=local_whisper in .env.
    """

    @property
    def provider_name(self) -> str:
        return "Local Whisper"

    @property
    def allowed_extensions(self) -> frozenset[str]:
        # pydub + FFmpeg can decode virtually any audio/video container
        return frozenset({
            ".mp3", ".mp4", ".wav", ".m4a",
            ".ogg", ".webm", ".flac", ".aac", ".opus",
        })

    @property
    def compression_threshold_bytes(self) -> int:
        return _LOCAL_COMPRESSION_THRESHOLD

    def transcribe(self, file_path: str) -> str:
        raise NotImplementedError(
            "Local Whisper provider is not yet implemented. "
            "See local_whisper.py for setup instructions."
        )
