import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranscription } from '../hooks/useTranscription'

interface FileUploadUIProps {
  allowedExtensions: string[]
  fallbackProviderKey?: string
}

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot === -1 ? '' : '.' + filename.slice(lastDot + 1).toLowerCase()
}

const DROPZONE_BASE: React.CSSProperties = {
  border: '2px dashed #ccc',
  borderRadius: 8,
  padding: '3rem 2rem',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.2s, background 0.2s',
  background: '#fafafa',
}

const DROPZONE_ACTIVE: React.CSSProperties = {
  ...DROPZONE_BASE,
  borderColor: '#4f46e5',
  background: '#eef2ff',
}

const TRANSCRIPT_AREA: React.CSSProperties = {
  width: '100%',
  minHeight: 240,
  marginTop: '1rem',
  padding: '0.75rem',
  fontFamily: 'monospace',
  fontSize: '0.875rem',
  lineHeight: 1.6,
  borderRadius: 6,
  border: '1px solid #d1d5db',
  resize: 'vertical',
  boxSizing: 'border-box',
}

const BUTTON: React.CSSProperties = {
  marginTop: '1rem',
  padding: '0.5rem 1.25rem',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
}

export function FileUploadUI({ allowedExtensions, fallbackProviderKey }: FileUploadUIProps): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const { status, progressMessage, transcript, errorMessage, canRetryWithLocal, transcribe, reset } =
    useTranscription()

  const onDrop = useCallback(
    (droppedFiles: File[]) => {
      const file = droppedFiles[0]
      if (!file) return

      const ext = getFileExtension(file.name)
      if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
        setValidationError(
          `"${ext}" is not supported. Accepted: ${allowedExtensions.join(', ')}`,
        )
        return
      }

      setValidationError(null)
      setSelectedFile(file)
      transcribe(file)
    },
    [allowedExtensions, transcribe],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    disabled: status === 'uploading',
  })

  function handleRetryWithLocalModel(): void {
    if (!selectedFile || !fallbackProviderKey) return
    reset()
    transcribe(selectedFile, fallbackProviderKey)
  }

  function handleReset(): void {
    setSelectedFile(null)
    setValidationError(null)
    reset()
  }

  if (status === 'uploading') {
    return (
      <div style={{ padding: '2rem 0', textAlign: 'center' }}>
        <p style={{ fontSize: '1.1rem', color: '#4f46e5' }}>⏳ {progressMessage}</p>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Do not close this tab while transcription is in progress.
        </p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div>
        <h3 style={{ marginBottom: 4 }}>Transcript</h3>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 0 }}>
          File: {selectedFile?.name}
        </p>
        <textarea readOnly value={transcript ?? ''} style={TRANSCRIPT_AREA} />
        <br />
        <button onClick={handleReset} style={{ ...BUTTON, background: '#e5e7eb', color: '#111' }}>
          Start over
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '1.5rem', background: '#fef2f2', borderRadius: 8, border: '1px solid #fca5a5' }}>
        <p style={{ color: '#b91c1c', fontWeight: 600, marginTop: 0 }}>Transcription failed</p>
        <p style={{ color: '#374151', fontSize: '0.9rem' }}>{errorMessage}</p>
        {canRetryWithLocal && (
          <button
            onClick={handleRetryWithLocalModel}
            style={{ ...BUTTON, background: '#4f46e5', color: '#fff', marginRight: 8 }}
          >
            Retry with local model
          </button>
        )}
        <button onClick={handleReset} style={{ ...BUTTON, background: '#e5e7eb', color: '#111' }}>
          Start over
        </button>
      </div>
    )
  }

  return (
    <div>
      <div
        {...getRootProps()}
        style={isDragActive ? DROPZONE_ACTIVE : DROPZONE_BASE}
      >
        <input {...getInputProps()} />
        <p style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
          {isDragActive ? 'Drop your file here…' : 'Drag & drop your meeting recording here'}
        </p>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>
          or click to browse &nbsp;·&nbsp; {allowedExtensions.join(', ')}
        </p>
      </div>
      {validationError && (
        <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginTop: '0.5rem' }}>
          {validationError}
        </p>
      )}
    </div>
  )
}
