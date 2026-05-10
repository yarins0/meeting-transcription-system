import { useEffect, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FileUploadUI } from './components/FileUploadUI'
import { ResultsView } from './components/ResultsView'
import { clearStoredSummaryResult } from './hooks/useSummarization'

interface ProviderInfo {
  provider_name: string
  allowed_extensions: string[]
  fallback_provider_key: string | null
}

const FALLBACK_EXTENSIONS = ['.flac', '.m4a', '.mp3', '.mp4', '.ogg', '.wav', '.webm']
const SESSION_TRANSCRIPT_KEY = 'mts_transcript'

function App(): JSX.Element {
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null)
  const [transcript, setTranscript] = useState<string | null>(
    () => sessionStorage.getItem(SESSION_TRANSCRIPT_KEY),
  )

  useEffect(() => {
    fetch('/api/provider-info')
      .then<ProviderInfo>(res => res.json())
      .then(data => setProviderInfo(data))
      .catch(() =>
        setProviderInfo({
          provider_name: 'Whisper API',
          allowed_extensions: FALLBACK_EXTENSIONS,
          fallback_provider_key: null,
        }),
      )
  }, [])

  function handleTranscriptReady(text: string): void {
    clearStoredSummaryResult()
    sessionStorage.setItem(SESSION_TRANSCRIPT_KEY, text)
    setTranscript(text)
  }

  function handleReset(): void {
    clearStoredSummaryResult()
    sessionStorage.removeItem(SESSION_TRANSCRIPT_KEY)
    setTranscript(null)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '0 1.5rem 5rem',
    }}>
      {/* Amber gradient rule across the top */}
      <div style={{
        width: '100%',
        maxWidth: 760,
        height: 2,
        background: 'linear-gradient(90deg, transparent, var(--accent) 30%, var(--accent) 70%, transparent)',
        marginBottom: '3rem',
        opacity: 0.6,
      }} />

      <div style={{ width: '100%', maxWidth: 760 }}>
        <header style={{ marginBottom: '2.75rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '0.875rem',
          }}>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.25rem, 6vw, 3.5rem)',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}>
              Meeting Transcription
            </h1>
            {providerInfo && !transcript && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                border: '1px solid var(--accent-border)',
                padding: '4px 10px',
                borderRadius: 2,
                marginBottom: '0.2rem',
              }}>
                {providerInfo.provider_name}
              </span>
            )}
          </div>

          <div style={{ height: 1, background: 'var(--border-strong)', marginBottom: '0.875rem' }} />

          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            fontWeight: 300,
            color: 'var(--text-secondary)',
            letterSpacing: '0.01em',
          }}>
            Upload a meeting recording — receive a full transcript and structured intelligence brief.
          </p>
        </header>

        <ErrorBoundary>
          {transcript !== null ? (
            <ResultsView transcript={transcript} onReset={handleReset} />
          ) : providerInfo === null ? (
            <div style={{
              padding: '4rem 0',
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              letterSpacing: '0.12em',
              color: 'var(--text-secondary)',
            }}>
              INITIALIZING<span style={{ animation: 'blink-cursor 1s step-end infinite' }}>_</span>
            </div>
          ) : (
            <FileUploadUI
              allowedExtensions={providerInfo.allowed_extensions}
              fallbackProviderKey={providerInfo.fallback_provider_key ?? undefined}
              onTranscriptReady={handleTranscriptReady}
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  )
}

export default App
