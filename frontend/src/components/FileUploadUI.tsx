import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranscription } from '../hooks/useTranscription'

interface FileUploadUIProps {
  allowedExtensions: string[]
  fallbackProviderKey?: string
  onTranscriptReady: (transcript: string) => void
}

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot === -1 ? '' : '.' + filename.slice(lastDot + 1).toLowerCase()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const WAVEFORM_BARS: Array<{ delay: string; height: number }> = [
  { delay: '0s',     height: 16 },
  { delay: '0.15s',  height: 28 },
  { delay: '0.30s',  height: 22 },
  { delay: '0.45s',  height: 38 },
  { delay: '0.10s',  height: 18 },
  { delay: '0.35s',  height: 34 },
  { delay: '0.20s',  height: 24 },
  { delay: '0.50s',  height: 40 },
  { delay: '0.05s',  height: 14 },
  { delay: '0.40s',  height: 30 },
  { delay: '0.25s',  height: 20 },
  { delay: '0.55s',  height: 36 },
  { delay: '0.08s',  height: 12 },
  { delay: '0.42s',  height: 26 },
]

function WaveformIcon({ isActive }: { isActive: boolean }): JSX.Element {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      height: 52,
      marginBottom: '1.5rem',
      opacity: isActive ? 1 : 0.5,
      transition: 'opacity 0.2s',
    }}>
      {WAVEFORM_BARS.map((bar, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: bar.height,
            background: 'var(--accent)',
            borderRadius: 2,
            transformOrigin: 'center',
            animation: `pulse-bar 1.6s ease-in-out ${bar.delay} infinite`,
          }}
        />
      ))}
    </div>
  )
}

export function FileUploadUI({ allowedExtensions, fallbackProviderKey, onTranscriptReady }: FileUploadUIProps): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const { status, progressMessage, transcript, errorMessage, canRetryWithLocal, transcribe, reset, cancel } =
    useTranscription()

  useEffect(() => {
    if (status === 'success' && transcript !== null) {
      onTranscriptReady(transcript)
    }
  }, [status, transcript, onTranscriptReady])

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
      // Transcription starts only when the user clicks Start
    },
    [allowedExtensions],
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

  function handleStart(): void {
    if (!selectedFile) return
    transcribe(selectedFile)
  }

  function handleCancel(): void {
    setSelectedFile(null)
    setValidationError(null)
    cancel()
  }

  function handleReset(): void {
    setSelectedFile(null)
    setValidationError(null)
    reset()
  }

  if (status === 'uploading') {
    return (
      <div style={{
        border: '1px solid var(--accent-border)',
        borderRadius: 3,
        padding: '2.5rem 2rem',
        background: 'var(--accent-dim)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.62rem',
          letterSpacing: '0.14em',
          color: 'var(--accent)',
          textTransform: 'uppercase',
          marginBottom: '0.875rem',
        }}>
          Signal Processing
        </div>
        {selectedFile && (
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.5rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {selectedFile.name}
          </p>
        )}
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.9rem',
          color: 'var(--text-primary)',
          marginBottom: '1.5rem',
          lineHeight: 1.5,
        }}>
          {progressMessage}
          <span style={{ animation: 'blink-cursor 1s step-end infinite' }}>_</span>
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.8rem',
            fontWeight: 300,
            color: 'var(--text-secondary)',
          }}>
            Do not close this tab — processing is in progress
          </p>
          <button
            onClick={handleCancel}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-strong)',
              borderRadius: 2,
              padding: '0.4rem 1rem',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Cancel
          </button>
        </div>
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'var(--border)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: '35%',
            background: 'var(--accent)',
            animation: 'indeterminate 1.8s ease-in-out infinite',
          }} />
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div style={{
        padding: '2.5rem 2rem',
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.82rem',
        letterSpacing: '0.06em',
        color: 'var(--green)',
        border: '1px solid var(--green-border)',
        borderRadius: 3,
        background: 'var(--green-dim)',
      }}>
        TRANSMISSION COMPLETE — preparing brief…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{
        padding: '1.75rem 2rem',
        background: 'var(--red-dim)',
        border: '1px solid var(--red-border)',
        borderRadius: 3,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6rem',
          letterSpacing: '0.14em',
          color: 'var(--red)',
          textTransform: 'uppercase',
          marginBottom: '0.625rem',
        }}>
          Transmission Failed
        </div>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.9rem',
          color: 'var(--text-primary)',
          marginBottom: '1.375rem',
          lineHeight: 1.55,
        }}>
          {errorMessage}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {canRetryWithLocal && (
            <button
              onClick={handleRetryWithLocalModel}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                background: 'var(--accent)',
                color: 'var(--text-on-accent)',
                border: 'none',
                borderRadius: 2,
                padding: '0.5rem 1.1rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Retry local model
            </button>
          )}
          <button
            onClick={handleReset}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-strong)',
              borderRadius: 2,
              padding: '0.5rem 1.1rem',
              cursor: 'pointer',
            }}
          >
            Start over
          </button>
        </div>
      </div>
    )
  }

  if (status === 'idle' && selectedFile !== null) {
    return (
      <div>
        <div
          {...getRootProps()}
          style={{
            border: isDragActive ? '1px solid var(--accent)' : '1px solid var(--accent-border)',
            borderRadius: 3,
            padding: '1.5rem 2rem',
            background: isDragActive ? 'var(--accent-dim)' : 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            transition: 'border-color 0.2s, background 0.25s',
            outline: 'none',
          }}
        >
          <input {...getInputProps()} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              letterSpacing: '0.14em',
              color: 'var(--accent)',
              textTransform: 'uppercase',
              marginBottom: '0.375rem',
            }}>
              Ready to process
            </div>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.95rem',
              color: 'var(--text-primary)',
              marginBottom: '0.2rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {selectedFile.name}
            </p>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
            }}>
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={(e) => { e.stopPropagation(); handleReset(); }}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 2,
                padding: '0.5rem 1rem',
                cursor: 'pointer',
              }}
            >
              Remove
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleStart(); }}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                background: 'var(--accent)',
                color: 'var(--text-on-accent)',
                border: 'none',
                borderRadius: 2,
                padding: '0.5rem 1.25rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Start Transcription
            </button>
          </div>
        </div>
        {validationError && (
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--red)',
            marginTop: '0.75rem',
            letterSpacing: '0.02em',
          }}>
            {validationError}
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <div
        {...getRootProps()}
        style={{
          border: isDragActive ? '1px solid var(--accent)' : '1px dashed var(--border-strong)',
          borderRadius: 3,
          padding: '3.75rem 2rem',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.2s, background 0.25s',
          background: isDragActive ? 'var(--accent-dim)' : 'var(--bg-surface)',
          outline: 'none',
        }}
      >
        <input {...getInputProps()} />
        <WaveformIcon isActive={isDragActive} />
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.3rem, 3.5vw, 1.75rem)',
          fontWeight: 600,
          letterSpacing: '0.01em',
          color: isDragActive ? 'var(--accent)' : 'var(--text-primary)',
          marginBottom: '0.625rem',
          transition: 'color 0.2s',
          lineHeight: 1.2,
        }}>
          {isDragActive ? 'Release to upload' : 'Drop your recording here'}
        </p>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          letterSpacing: '0.08em',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
        }}>
          or click to browse&nbsp;&nbsp;·&nbsp;&nbsp;{allowedExtensions.join('  ')}
        </p>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6rem',
          letterSpacing: '0.06em',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          marginTop: '0.5rem',
          opacity: 0.55,
        }}>
          Over 24 MB? Auto-compressed&nbsp;&nbsp;·&nbsp;&nbsp;500 MB max
        </p>
      </div>
      {validationError && (
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--red)',
          marginTop: '0.75rem',
          letterSpacing: '0.02em',
        }}>
          {validationError}
        </p>
      )}
    </div>
  )
}
