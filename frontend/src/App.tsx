import { useEffect, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FileUploadUI } from './components/FileUploadUI'

interface ProviderInfo {
  provider_name: string
  allowed_extensions: string[]
  fallback_provider_key: string | null
}

// Used when /provider-info is unreachable so the UI stays functional.
const FALLBACK_EXTENSIONS = ['.flac', '.m4a', '.mp3', '.mp4', '.ogg', '.wav', '.webm']

function App(): JSX.Element {
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null)

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

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: 4 }}>Meeting Transcription</h1>
      <p style={{ color: '#6b7280', marginTop: 0 }}>
        Upload a meeting recording to get a full transcript.
        {providerInfo && (
          <span style={{ marginLeft: 8, fontSize: '0.8rem', background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 4 }}>
            {providerInfo.provider_name}
          </span>
        )}
      </p>
      <ErrorBoundary>
        {providerInfo === null ? (
          <p style={{ color: '#9ca3af' }}>Loading…</p>
        ) : (
          <FileUploadUI
            allowedExtensions={providerInfo.allowed_extensions}
            fallbackProviderKey={providerInfo.fallback_provider_key ?? undefined}
          />
        )}
      </ErrorBoundary>
    </div>
  )
}

export default App
