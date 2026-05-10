# Research Phase

At first the only tool at the tech-stack I had to research was OpenAI Whisper API and other transcription models that are also stable and provide hebrew support (as I've found Whisper to provide).
I encountered a wide variety of models but decided to stick with the recommended one while also planing on not using an interface for model calls which will let the code be mainly ,model agnostic.
The thought is leaving room for additions - like letting user choose the model they would like to use, or making whoever clones this projects life easier but i wont add it in my limited 5hr window. (I didnt act in a similar way in a former project "TuneCraft"- the code was writen for only one music platform and it made my life harder when i wanted to add more later).
I also found this video that might come in handy late, but again probably wont have the time for model tuning with my time window ([Transcription Models Zero to Hero - Data Prep, Train + Serve](https://www.youtube.com/watch?v=ORnnufNjw10)). 

After looking up Whisper specifically [Openai docs](https://developers.openai.com/api/docs/guides/speech-to-text), what i got is that the file uploads are currently limited to 25 MB, and that i can expand the type support to mp3, mp4, mpeg, mpga, m4a, wav, and webm and that there is a variety of output file types. Also that the Supported languages includes English and Hebrew whice are currently my main concerns.

# Planning Phase

Prompt: /arch-planner in theis plan include Wisper API but lets use it as an interface in order to make other models accessable in the future. (with the provided assignment.pdf added). 
This is the skill description: "Act as a senior software architect to help users design, plan, and validate software systems. Use this skill whenever a user wants to brainstorm a new project, get tech stack recommendations, break a system into components, generate an implementation plan, think through edge cases and failure modes, or stress-test a plan against engineering principles (YAGNI, SOLID, DRY, KISS)".

After Brainsorming with claude i decided:
- Whisper fallback trigger - Use local Whisper if the API failes.
Show the user an error with a "retry with local model" button: user is aware of the switch, you don't need local Whisper pre-installed.
- Use pydub library to compress files bigger than 25MB.
- Multi-language meetings - Detect the dominant language, summarize entirely in that language.
- Sync vs. async processing - use SSE to stream progress

Claude has also raised this flag: What breaks first: The Word export with Hebrew text. python-docx has poor RTL support — the text appears but runs left-to-right. 
with the Fix: either test early and add explicit RTL paragraph formatting.

# Execution Phase

## Phase 1 of PLAN
In  a new project folder with only PLAN.md in it:

- Prompt in plan mode for claude code: @PLAN.md this project is all about this plan - read it and describe your plan before writing any code. (There are also rules in the global CLAUDE.md whice the agent aboeys).

After presenting a solid plan claude atarted and finished Phase 1 of the plan with Both servers are running. Phase 1 exit criteria met:
GET http://localhost:8001/health → {"status": "ok"}
GET http://localhost:5173 → HTTP 200 (React app loads)yes

after a code review i noticed there were global vars named ALLOWED_EXTENSIONS, COMPRESSION_THRESHOLD_BYTES in backend\main.py so:
- Prompt: each model interface should have its own ALLOWED_EXTENSIONS, COMPRESSION_THRESHOLD_BYTES

- Prompt: create [CLAUDE.md](http://CLAUDE.md) and /handoff

## Phase 2 of PLAN
Simply pasted the prompt given by the previous session into a new claude code session in palnning mode, after approving the plan (which looked fine).

Prompt: /review (just activated a code review for phase 2 whice actualy found 2 bugs)

Later on I reviewed what was done manually and did a smoke test.

Initiall commit using claude to phrase the notes and creating .gitignore (double and triple checking .env isnt there).

- Prompt: /handoff

## Phase 3 of PLAN
I paste the handoff prompt in plan mode, while claud thinks i generate both API keys needed and paste into .env.

when pasing a smaller file                                                     
❯ Missing credentials. Please pass an `api_key`, `workload_identity`, `admin_api_key`, or 
set the `OPENAI_API_KEY` or `OPENAI_ADMIN_KEY` environment variable. 
When putting  a bigger one (82.9.MB) ❯ "No module named 'pyaudioop'"

This started a long debugging session, meanwhile i ran a purly frontend-design agent and deployed to a new branch.

After some time another error acuured that made me relise that the code cant see ANY .env vars, so i fixed the import and now both the transcription and summary work well for files smaller than 25MB - English meething.

- Prompt /debug 
Error code: 413 - {'error': {'message': '413: Maximum content size limit (26214400)     
  exceeded (26265624 bytes read)', 'type': 'server_error', 'param': None, 'code': None},  
  'usage': {'type': 'duration', 'seconds': 0}} for the big file, also got Local Whisper   
  provider is not yet implemented. See local_whisper.py for setup instructions. error     
  after hitting try fallback button.

The problem was that the compreesion wasnt enough- the comprased file was 26MB, calude suggested upping the bitrate in order to get a smaller file.

- Prompt: can we compute the minimal bit rate needed? that way we can get as close as we can to
  25MB.

- Prompt: This is too messy, lets try splitting the file to smaller pieces instead

The 413 still hsant resolved becaude "the mp3 encoder runs 4–5% over the target bitrate, pushing 23.8 MB theoretical → 25.1 MB actual." as claude claims which seems right after testing and logging the actual sizes.

The bigger 83MB .mps file worked!, time to check other file types - the test should be dumb - just check if the split works fine and than if the transcription work for the first 2 parts in order to not waste tokens.

- Prompt: /document-release (skill that updated the docs and pushed the code)

- Prompt /handoff

## Phase 4 of PLAN

I paste the handoff prompt in plan mode and went over the plan.

After some adjustments like: "account for right to left languages" claude started executing the plan.

While claude builds, i tested for .wav file with an hebrew meeting which got back an empty transcript from Whisper and crushed the app, than added an empty response handling.
The response was full on the next time (didnt display right to left on the web so fixed with anoter agent that also added sessionStorage use).

After checking the .docx file for the hbrew .wav meeting:
- Prompt: the docx file is missing the transcript section + the table content doesnt turn right to left when needed

After those fixes the full export flow worked correctly for Hebrew .wav — all 5 sections in the .docx, table columns RTL, paragraph text RTL, transcript included.

- Prompt: /handoff

## Phase 5 of PLAN (Hardening & Tests)

Pasted the handoff prompt in plan mode. Plan covered: fix the local_whisper fallback error message, write the pytest suite, test the split path live, and commit everything.

Fixed `local_whisper.py` — changed the `NotImplementedError` (which had dev-facing setup instructions leaking into the UI) to a clean `RuntimeError`: "Local Whisper model is not configured on this server."

Claude wrote 44 tests across 4 files in `backend/tests/`:
- `test_summarization.py` — empty transcript guard, markdown fence stripping, malformed JSON, wrong Pydantic schema, happy path
- `test_export.py` — all sections present, RTL bidi on Hebrew/Arabic/Persian/Urdu paragraphs and table, null due date, empty collections fallback text
- `test_endpoints.py` — /health, /summarize with mocked Claude, /export with mocked build_docx, Pydantic validation errors
- `test_compression.py` — _target_bitrate clamping to min/max, below-threshold passthrough, single-segment and multi-segment splitting with start offset verification

All 44 tests pass in ~2.5s.

Tested the split path live: lowered `_COMPRESS_THRESHOLD` and `_COMPRESS_TARGET` in `whisper_api.py` to force splitting — confirmed "Transcribing part 1 of N…" SSE progress messages appeared in the UI and the final joined transcript was correct.

- Prompt: update plan.md and the other docs
- Prompt: yes (commit and push)    