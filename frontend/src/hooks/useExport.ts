import { useState } from 'react'

import type { SummaryResult } from './useSummarization'

interface ExportState {
  isExporting: boolean
  exportError: string | null
}

export interface UseExportResult extends ExportState {
  triggerExport: (summary: SummaryResult, transcript: string) => void
}

export function useExport(): UseExportResult {
  const [state, setState] = useState<ExportState>({ isExporting: false, exportError: null })

  function triggerExport(summary: SummaryResult, transcript: string): void {
    void runExport(summary, transcript, setState)
  }

  return { ...state, triggerExport }
}

async function runExport(
  summary: SummaryResult,
  transcript: string,
  setState: React.Dispatch<React.SetStateAction<ExportState>>,
): Promise<void> {
  setState({ isExporting: true, exportError: null })

  let response: Response
  try {
    response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...summary, transcript }),
    })
  } catch {
    setState({ isExporting: false, exportError: 'Network error — could not reach the server.' })
    return
  }

  if (!response.ok) {
    setState({ isExporting: false, exportError: `Export failed (HTTP ${response.status}).` })
    return
  }

  let blob: Blob
  try {
    blob = await response.blob()
  } catch {
    setState({ isExporting: false, exportError: 'Failed to read server response.' })
    return
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'meeting-summary.docx'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)

  setState({ isExporting: false, exportError: null })
}
