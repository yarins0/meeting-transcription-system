import { useState } from 'react'

export interface ActionItem {
  task: string
  owner: string
  due: string | null
}

export interface SummaryResult {
  language: string
  summary: string
  participants: string[]
  decisions: string[]
  action_items: ActionItem[]
}

type SummarizationStatus = 'idle' | 'loading' | 'success' | 'error'

interface SummarizationState {
  status: SummarizationStatus
  result: SummaryResult | null
  errorMessage: string | null
}

export interface UseSummarizationResult extends SummarizationState {
  summarize: (transcript: string) => void
  reset: () => void
}

const INITIAL_STATE: SummarizationState = {
  status: 'idle',
  result: null,
  errorMessage: null,
}

const SESSION_RESULT_KEY = 'mts_summary_result'

export function clearStoredSummaryResult(): void {
  sessionStorage.removeItem(SESSION_RESULT_KEY)
}

function loadStoredState(): SummarizationState {
  const stored = sessionStorage.getItem(SESSION_RESULT_KEY)
  if (stored === null) return INITIAL_STATE
  try {
    const result = JSON.parse(stored) as SummaryResult
    return { status: 'success', result, errorMessage: null }
  } catch {
    return INITIAL_STATE
  }
}

export function useSummarization(): UseSummarizationResult {
  const [state, setState] = useState<SummarizationState>(loadStoredState)

  function reset(): void {
    sessionStorage.removeItem(SESSION_RESULT_KEY)
    setState(INITIAL_STATE)
  }

  function summarize(transcript: string): void {
    if (state.status === 'success') return
    void runSummarization(transcript, setState)
  }

  return { ...state, summarize, reset }
}

async function runSummarization(
  transcript: string,
  setState: React.Dispatch<React.SetStateAction<SummarizationState>>,
): Promise<void> {
  setState({ status: 'loading', result: null, errorMessage: null })

  let response: Response
  try {
    response = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    })
  } catch {
    setState({ status: 'error', result: null, errorMessage: 'Network error — could not reach the server.' })
    return
  }

  if (!response.ok) {
    setState({ status: 'error', result: null, errorMessage: `Summarization failed (HTTP ${response.status}).` })
    return
  }

  let data: SummaryResult
  try {
    data = (await response.json()) as SummaryResult
  } catch {
    setState({ status: 'error', result: null, errorMessage: 'Server returned an unexpected response.' })
    return
  }

  sessionStorage.setItem(SESSION_RESULT_KEY, JSON.stringify(data))
  setState({ status: 'success', result: data, errorMessage: null })
}
