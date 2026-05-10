import json
from unittest.mock import MagicMock, patch

import pytest

from summarization import SummaryResponse, SummaryService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _valid_payload() -> dict:
    return {
        "language": "English",
        "summary": "A productive meeting with clear outcomes.",
        "participants": ["Alice", "Bob"],
        "decisions": ["Proceed with plan A."],
        "action_items": [{"task": "Review the draft", "owner": "Alice", "due": "2024-01-15"}],
    }


def _mock_message(text: str) -> MagicMock:
    """Build a minimal mock that looks like an Anthropic Message with one text block."""
    block = MagicMock()
    block.text = text
    message = MagicMock()
    message.content = [block]
    return message


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_empty_transcript_raises_before_api_call():
    # ValueError must fire before any network call — no mocking needed.
    with pytest.raises(ValueError, match="empty"):
        SummaryService().summarize("   ")


@patch.object(SummaryService, "_get_client")
def test_happy_path_returns_summary_response(mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_client.messages.create.return_value = _mock_message(json.dumps(_valid_payload()))

    result = SummaryService().summarize("Alice: Let's proceed.\nBob: Agreed.")

    assert isinstance(result, SummaryResponse)
    assert result.language == "English"
    assert result.participants == ["Alice", "Bob"]
    assert result.decisions == ["Proceed with plan A."]
    assert len(result.action_items) == 1
    assert result.action_items[0].owner == "Alice"


@patch.object(SummaryService, "_get_client")
def test_markdown_fence_is_stripped_before_parsing(mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    fenced = f"```json\n{json.dumps(_valid_payload())}\n```"
    mock_client.messages.create.return_value = _mock_message(fenced)

    result = SummaryService().summarize("Some transcript content.")

    assert result.language == "English"


@patch.object(SummaryService, "_get_client")
def test_malformed_json_raises_decode_error(mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    mock_client.messages.create.return_value = _mock_message("not valid json at all")

    with pytest.raises(json.JSONDecodeError):
        SummaryService().summarize("Some transcript.")


@patch.object(SummaryService, "_get_client")
def test_wrong_schema_raises_value_error(mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    # Valid JSON but missing all required fields
    mock_client.messages.create.return_value = _mock_message(json.dumps({"wrong_field": "x"}))

    with pytest.raises(ValueError, match="unexpected JSON structure"):
        SummaryService().summarize("Some transcript.")


@patch.object(SummaryService, "_get_client")
def test_empty_api_response_raises_value_error(mock_get_client):
    mock_client = MagicMock()
    mock_get_client.return_value = mock_client
    message = MagicMock()
    message.content = []
    mock_client.messages.create.return_value = message

    with pytest.raises(ValueError, match="empty response"):
        SummaryService().summarize("Some transcript.")
