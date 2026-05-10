from .base import TranscriptionProvider

_GB = 1024 * 1024 * 1024


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
        return frozenset({
            ".mp3", ".mp4", ".wav", ".m4a",
            ".ogg", ".webm", ".flac", ".aac", ".opus",
        })

    @property
    def compression_threshold_bytes(self) -> int:
        return 500 * 1024 * 1024  # compress above 500 MB to reduce RAM pressure

    @property
    def upload_size_limit_bytes(self) -> int:
        return 2 * _GB  # effectively no limit for a local model

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
        raise NotImplementedError(
            "Local Whisper provider is not yet implemented. "
            "See local_whisper.py for setup instructions."
        )
