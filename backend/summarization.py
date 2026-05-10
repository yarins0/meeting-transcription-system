import json
import os
from pathlib import Path

import anthropic
from pydantic import BaseModel, ValidationError

SYSTEM_PROMPT = (Path(__file__).parent / "prompts.md").read_text(encoding="utf-8")

_MODEL = "claude-sonnet-4-6"
_MAX_TOKENS = 2048


class ActionItem(BaseModel):
    task: str
    owner: str
    due: str | None = None


class SummaryResponse(BaseModel):
    language: str
    summary: str
    participants: list[str]
    decisions: list[str]
    action_items: list[ActionItem]


class SummarizeRequest(BaseModel):
    transcript: str


class SummaryService:
    def _get_client(self) -> anthropic.Anthropic:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
        return anthropic.Anthropic(api_key=api_key)

    def summarize(self, transcript: str) -> SummaryResponse:
        if not transcript.strip():
            raise ValueError("Transcript is empty — nothing to summarize.")

        client = self._get_client()
        message = client.messages.create(
            model=_MODEL,
            max_tokens=_MAX_TOKENS,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": transcript}],
            timeout=120.0,
        )

        if not message.content:
            raise ValueError("Claude returned an empty response.")

        raw_json = message.content[0].text.strip()

        # Claude sometimes wraps JSON in a markdown code fence despite being told not to.
        if raw_json.startswith("```"):
            raw_json = raw_json.split("\n", 1)[-1]
            raw_json = raw_json.rsplit("```", 1)[0].strip()

        if not raw_json:
            raise ValueError("Claude returned an empty response body.")

        data = json.loads(raw_json)
        try:
            return SummaryResponse(**data)
        except ValidationError as exc:
            raise ValueError(f"Claude returned an unexpected JSON structure: {exc}") from exc
