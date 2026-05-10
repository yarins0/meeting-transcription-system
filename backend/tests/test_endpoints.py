from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from summarization import ActionItem, SummaryResponse


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def _summary_response() -> SummaryResponse:
    return SummaryResponse(
        language="English",
        summary="A productive meeting.",
        participants=["Alice"],
        decisions=["Proceed."],
        action_items=[ActionItem(task="Review docs", owner="Alice", due=None)],
    )


def _export_payload() -> dict:
    return {
        "language": "English",
        "summary": "A productive meeting.",
        "participants": ["Alice"],
        "decisions": ["Proceed."],
        "action_items": [{"task": "Review docs", "owner": "Alice", "due": None}],
        "transcript": "Alice: Hello.",
    }


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

def test_health_returns_ok(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# /summarize
# ---------------------------------------------------------------------------

@patch("main.SummaryService")
def test_summarize_returns_200_with_valid_transcript(mock_cls, client: TestClient):
    mock_service = MagicMock()
    mock_cls.return_value = mock_service
    mock_service.summarize.return_value = _summary_response()

    response = client.post("/summarize", json={"transcript": "Alice: Hello."})

    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "English"
    assert data["summary"] == "A productive meeting."
    assert data["participants"] == ["Alice"]


@patch("main.SummaryService")
def test_summarize_propagates_empty_transcript_error(mock_cls):
    # raise_server_exceptions=False tells TestClient to return the HTTP error
    # response rather than re-raising the exception in the test thread.
    error_client = TestClient(app, raise_server_exceptions=False)
    mock_service = MagicMock()
    mock_cls.return_value = mock_service
    mock_service.summarize.side_effect = ValueError("Transcript is empty — nothing to summarize.")

    response = error_client.post("/summarize", json={"transcript": "   "})

    assert response.status_code == 500


def test_summarize_rejects_missing_transcript_field(client: TestClient):
    # Pydantic validation error: required field missing.
    response = client.post("/summarize", json={})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# /export
# ---------------------------------------------------------------------------

@patch("main.build_docx", return_value=b"fake-docx-content")
def test_export_returns_200_with_docx_content(mock_build, client: TestClient):
    response = client.post("/export", json=_export_payload())

    assert response.status_code == 200
    assert response.content == b"fake-docx-content"
    assert "attachment" in response.headers["content-disposition"]
    assert "meeting-summary.docx" in response.headers["content-disposition"]


@patch("main.build_docx", return_value=b"fake-docx-content")
def test_export_sets_correct_content_type(mock_build, client: TestClient):
    response = client.post("/export", json=_export_payload())

    assert "wordprocessingml" in response.headers["content-type"]


def test_export_rejects_missing_transcript_field(client: TestClient):
    payload = _export_payload()
    del payload["transcript"]
    response = client.post("/export", json=payload)
    assert response.status_code == 422
