import { useState, useRef } from 'react'
import { API_BASE } from '../config'

type TranscriptionStatus = 'idle' | 'uploading' | 'success' | 'error'

interface TranscriptionState {
  status: TranscriptionStatus
  progressMessage: string
  transcript: string | null
  errorMessage: string | null
  canRetryWithLocal: boolean
}

export interface UseTranscriptionResult extends TranscriptionState {
  transcribe: (file: File, providerOverride?: string) => void
  reset: () => void
  cancel: () => void
}

interface SseEvent {
  type: 'progress' | 'result' | 'error'
  message?: string
  transcript?: string
  retryWithLocal?: boolean
}

const INITIAL_STATE: TranscriptionState = {
  status: 'idle',
  progressMessage: '',
  transcript: null,
  errorMessage: null,
  canRetryWithLocal: false,
}

function parseSseChunk(chunk: string): SseEvent | null {
  const trimmed = chunk.trim()
  if (!trimmed.startsWith('data: ')) return null
  try {
    return JSON.parse(trimmed.slice(6)) as SseEvent
  } catch {
    return null
  }
}

// Returns true when the event is terminal (result or error) and reading should stop.
function applyEvent(
  event: SseEvent,
  setState: React.Dispatch<React.SetStateAction<TranscriptionState>>,
): boolean {
  if (event.type === 'progress') {
    setState(prev => ({ ...prev, progressMessage: event.message ?? '' }))
    return false
  }
  if (event.type === 'result') {
    setState({
      status: 'success',
      progressMessage: '',
      transcript: event.transcript ?? '',
      errorMessage: null,
      canRetryWithLocal: false,
    })
    return true
  }
  if (event.type === 'error') {
    setState({
      status: 'error',
      progressMessage: '',
      transcript: null,
      errorMessage: event.message ?? 'Unknown error',
      canRetryWithLocal: event.retryWithLocal ?? false,
    })
    return true
  }
  return false
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  setState: React.Dispatch<React.SetStateAction<TranscriptionState>>,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  outer: while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const event = parseSseChunk(chunk)
      if (event && applyEvent(event, setState)) break outer
    }
  }
}

export function useTranscription(): UseTranscriptionResult {
  const [state, setState] = useState<TranscriptionState>(INITIAL_STATE)
  const abortControllerRef = useRef<AbortController | null>(null)

  function reset(): void {
    setState(INITIAL_STATE)
  }

  function cancel(): void {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setState(INITIAL_STATE)
  }

  function transcribe(file: File, providerOverride?: string): void {
    const controller = new AbortController()
    abortControllerRef.current = controller
    void runTranscription(file, providerOverride, setState, controller.signal)
  }

  return { ...state, transcribe, reset, cancel }
}

async function runTranscription(
  file: File,
  providerOverride: string | undefined,
  setState: React.Dispatch<React.SetStateAction<TranscriptionState>>,
  signal: AbortSignal,
): Promise<void> {
  setState({ ...INITIAL_STATE, status: 'uploading', progressMessage: 'Uploading...' })

  const formData = new FormData()
  formData.append('file', file)

  const url = providerOverride
    ? `${API_BASE}/transcribe?provider=${encodeURIComponent(providerOverride)}`
    : `${API_BASE}/transcribe`

  let response: Response
  try {
    response = await fetch(url, { method: 'POST', body: formData, signal })
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    setState({
      status: 'error',
      progressMessage: '',
      transcript: null,
      errorMessage: 'Network error — could not reach the server.',
      canRetryWithLocal: false,
    })
    return
  }

  if (!response.body) {
    setState({
      status: 'error',
      progressMessage: '',
      transcript: null,
      errorMessage: 'Server returned an empty response.',
      canRetryWithLocal: false,
    })
    return
  }

  try {
    await readSseStream(response.body, setState)
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    // Stream dropped mid-way (network failure after the initial connection).
    setState({
      status: 'error',
      progressMessage: '',
      transcript: null,
      errorMessage: 'Connection lost during transcription. Please try again.',
      canRetryWithLocal: false,
    })
  }
}
