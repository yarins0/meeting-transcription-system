import json
import os

import anthropic
from pydantic import BaseModel

_SYSTEM_PROMPT = """\
You are an expert meeting analyst. You will receive a raw transcript of a meeting.
Your task is to extract structured information and return it as valid JSON only —
no markdown, no preamble, no explanation.

Return this exact structure:
{
  "language": "The dominant language of the meeting (e.g. Hebrew, English)",
  "summary": "2-3 sentence overview of what the meeting was about and its outcome",
  "participants": ["Name or role if identifiable, otherwise 'Speaker 1', 'Speaker 2'..."],
  "decisions": ["Each concrete decision made, as a clear declarative sentence"],
  "action_items": [
    {
      "task": "What needs to be done (start with a verb)",
      "owner": "Who is responsible, or 'Unassigned'",
      "due": "Deadline if mentioned, else null"
    }
  ]
}

Rules:
- Respond entirely in the dominant language of the meeting
- If speakers switch languages, use the language that dominates by word count
- If no decisions were made, return an empty array for 'decisions'
- If no action items exist, return an empty array for 'action_items'
- Preserve names exactly as spoken — do not translate proper nouns
- Every action item task must start with a verb\
"""

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
        client = self._get_client()
        message = client.messages.create(
            model=_MODEL,
            max_tokens=_MAX_TOKENS,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": transcript}],
        )
        raw_json = message.content[0].text
        data = json.loads(raw_json)
        return SummaryResponse(**data)
