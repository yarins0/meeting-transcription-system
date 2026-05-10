from abc import ABC, abstractmethod


class TranscriptionProvider(ABC):
    """
    Contract every transcription backend must satisfy.
    Each provider declares its own format support and size constraints so that
    validation and compression in the endpoint layer are driven by provider config,
    not hardcoded globals.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable name shown in progress messages and UI badges."""
        ...

    @property
    @abstractmethod
    def allowed_extensions(self) -> frozenset[str]:
        """
        File extensions this provider can accept (lowercase, dot-prefixed).
        Example: frozenset({".mp3", ".wav", ".m4a"})
        """
        ...

    @property
    @abstractmethod
    def compression_threshold_bytes(self) -> int:
        """
        Files larger than this will be compressed to mp3 before being sent to
        the provider. Set to a very large value to effectively disable compression.
        """
        ...

    @abstractmethod
    def transcribe(self, file_path: str) -> str:
        """
        Transcribe the audio file at file_path and return the full transcript.

        Blocks until complete — callers wrap this in asyncio.to_thread().
        Raises on any failure; error handling is the caller's responsibility.
        """
        ...
