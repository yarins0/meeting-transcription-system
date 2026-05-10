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
        """Files larger than this will be compressed before being sent to the provider."""
        ...

    @property
    @abstractmethod
    def upload_size_limit_bytes(self) -> int:
        """Hard maximum the provider will accept per request."""
        ...

    @property
    @abstractmethod
    def compression_target_bytes(self) -> int:
        """Target output size when compressing — should include headroom below upload_size_limit_bytes
        to account for mp3 encoder variance (~5–8% over the nominal bitrate target)."""
        ...

    @property
    @abstractmethod
    def min_compression_bitrate_kbps(self) -> int:
        """Lowest acceptable audio bitrate; below this speech quality degrades too much."""
        ...

    @property
    @abstractmethod
    def max_compression_bitrate_kbps(self) -> int:
        """Highest useful bitrate — no perceptible benefit beyond this for mono speech."""
        ...

    @abstractmethod
    def transcribe(self, file_path: str) -> str:
        """
        Transcribe the audio file at file_path and return the full transcript.

        Blocks until complete — callers wrap this in asyncio.to_thread().
        Raises on any failure; error handling is the caller's responsibility.
        """
        ...
