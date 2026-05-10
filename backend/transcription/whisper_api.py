import openai

from .base import TranscriptionProvider

# Whisper API enforces a 25 MB request limit; compress anything above 24 MB to stay safe.
_WHISPER_COMPRESSION_THRESHOLD = 24 * 1024 * 1024


class WhisperApiProvider(TranscriptionProvider):
    """Transcribes via OpenAI's hosted Whisper API (model: whisper-1)."""

    def __init__(self) -> None:
        # Client is created lazily in transcribe() so that provider metadata
        # (name, extensions) is available even without an API key configured.
        self._client: openai.OpenAI | None = None

    def _get_client(self) -> openai.OpenAI:
        if self._client is None:
            self._client = openai.OpenAI()
        return self._client

    @property
    def provider_name(self) -> str:
        return "Whisper API"

    @property
    def allowed_extensions(self) -> frozenset[str]:
        # Full list from https://platform.openai.com/docs/guides/speech-to-text
        return frozenset({".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"})

    @property
    def compression_threshold_bytes(self) -> int:
        return _WHISPER_COMPRESSION_THRESHOLD

    def transcribe(self, file_path: str) -> str:
        with open(file_path, "rb") as audio_file:
            response = self._get_client().audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
            )
        return response.text
