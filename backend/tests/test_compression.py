from unittest.mock import call, patch

import pytest

from main import _prepare_audio_segments, _target_bitrate
from transcription.base import TranscriptionProvider


# ---------------------------------------------------------------------------
# Minimal provider stub for testing compression logic
# ---------------------------------------------------------------------------

class _StubProvider(TranscriptionProvider):
    """Provider with values that make the maths easy to reason about in tests."""

    @property
    def provider_name(self) -> str:
        return "Stub"

    @property
    def allowed_extensions(self) -> frozenset[str]:
        return frozenset({".mp3"})

    @property
    def compression_threshold_bytes(self) -> int:
        # Files above 100 KB trigger compression.
        return 100_000

    @property
    def upload_size_limit_bytes(self) -> int:
        return 500_000

    @property
    def compression_target_bytes(self) -> int:
        # Target is 800 KB → max_segment_secs = (800_000 * 8) // (16 * 1000) = 400 s
        return 800_000

    @property
    def min_compression_bitrate_kbps(self) -> int:
        return 16

    @property
    def max_compression_bitrate_kbps(self) -> int:
        return 128

    def transcribe(self, file_path: str) -> str:
        raise NotImplementedError


# ---------------------------------------------------------------------------
# _target_bitrate
# ---------------------------------------------------------------------------

def test_target_bitrate_clamps_to_max():
    # 800_000 bytes * 8 / 10 s / 1000 = 640 kbps → clamped to 128
    assert _target_bitrate(10.0, _StubProvider()) == "128k"


def test_target_bitrate_clamps_to_min():
    # 800_000 bytes * 8 / 10_000 s / 1000 = 0.64 kbps → clamped to 16
    assert _target_bitrate(10_000.0, _StubProvider()) == "16k"


def test_target_bitrate_within_bounds():
    # 800_000 bytes * 8 / 100 s / 1000 = 64 kbps → within [16, 128]
    assert _target_bitrate(100.0, _StubProvider()) == "64k"


# ---------------------------------------------------------------------------
# _prepare_audio_segments — below threshold (no compression)
# ---------------------------------------------------------------------------

@patch("main.os.path.getsize", return_value=50_000)  # below 100_000 threshold
def test_below_threshold_returns_input_path_unchanged(mock_getsize):
    result = _prepare_audio_segments("input.mp3", _StubProvider())
    assert result == ["input.mp3"]
    mock_getsize.assert_called_once_with("input.mp3")


# ---------------------------------------------------------------------------
# _prepare_audio_segments — above threshold, single segment
# ---------------------------------------------------------------------------

@patch("main.os.path.getsize", return_value=200_000)  # above threshold
@patch("main._audio_duration_seconds", return_value=300.0)  # 300 s < 400 s max_segment
@patch("main._compress_segment", return_value="/tmp/seg0.mp3")
def test_above_threshold_single_segment(mock_compress, mock_duration, mock_getsize):
    result = _prepare_audio_segments("input.mp3", _StubProvider())

    assert result == ["/tmp/seg0.mp3"]
    mock_compress.assert_called_once()
    # Single-segment call must use start=0 and duration=0 (entire file).
    args = mock_compress.call_args[0]
    assert args[0] == "input.mp3"
    assert args[1] == 0   # start
    assert args[2] == 0   # duration (0 means "to end")


# ---------------------------------------------------------------------------
# _prepare_audio_segments — above threshold, multi-segment
# ---------------------------------------------------------------------------

@patch("main.os.path.getsize", return_value=200_000)
@patch("main._audio_duration_seconds", return_value=1000.0)  # 1000 s > 400 s max → 3 segments
@patch("main._compress_segment", return_value="/tmp/seg.mp3")
def test_above_threshold_multi_segment_count(mock_compress, mock_duration, mock_getsize):
    # ceil(1000 / 400) = 3 segments
    result = _prepare_audio_segments("input.mp3", _StubProvider())

    assert len(result) == 3
    assert mock_compress.call_count == 3


@patch("main.os.path.getsize", return_value=200_000)
@patch("main._audio_duration_seconds", return_value=1000.0)
@patch("main._compress_segment", return_value="/tmp/seg.mp3")
def test_above_threshold_multi_segment_uses_min_bitrate(mock_compress, mock_duration, mock_getsize):
    _prepare_audio_segments("input.mp3", _StubProvider())
    # Every segment call should use the minimum bitrate string.
    for segment_call in mock_compress.call_args_list:
        bitrate_arg = segment_call[0][3]
        assert bitrate_arg == "16k"


@patch("main.os.path.getsize", return_value=200_000)
@patch("main._audio_duration_seconds", return_value=1000.0)
@patch("main._compress_segment", return_value="/tmp/seg.mp3")
def test_above_threshold_multi_segment_start_offsets(mock_compress, mock_duration, mock_getsize):
    # With duration=1000s and 3 segments, each segment is ceil(1000/3)=334 s.
    _prepare_audio_segments("input.mp3", _StubProvider())
    starts = [c[0][1] for c in mock_compress.call_args_list]
    # Segments must start at 0, 334, 668 (non-decreasing, first is 0).
    assert starts[0] == 0
    assert starts[1] > 0
    assert starts[2] > starts[1]
