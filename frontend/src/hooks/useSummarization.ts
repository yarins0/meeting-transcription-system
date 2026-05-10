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

export function useSummarization(): UseSummarizationResult {
  const [state, setState] = useState<SummarizationState>(INITIAL_STATE)

  function reset(): void {
    setState(INITIAL_STATE)
  }

  function summarize(transcript: string): void {
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

  setState({ status: 'success', result: data, errorMessage: null })
}
