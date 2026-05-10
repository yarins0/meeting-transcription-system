import { useEffect } from 'react'
import { useSummarization, type ActionItem, type SummaryResult } from '../hooks/useSummarization'

interface ResultsViewProps {
  transcript: string
  onReset: () => void
}

function LanguageBadge({ language }: { language: string }): JSX.Element {
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.6rem',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--accent)',
      border: '1px solid var(--accent-border)',
      padding: '4px 10px',
      borderRadius: 2,
    }}>
      {language}
    </span>
  )
}

function SectionBlock({ number, title, children, delay }: {
  number: string
  title: string
  children: React.ReactNode
  delay: number
}): JSX.Element {
  return (
    <div style={{
      marginBottom: '2.25rem',
      animation: 'fade-up 0.5s ease-out both',
      animationDelay: `${delay}ms`,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1rem',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6rem',
          fontWeight: 500,
          letterSpacing: '0.12em',
          color: 'var(--accent)',
          flexShrink: 0,
        }}>
          {number}
        </span>
        <div style={{ height: 1, background: 'var(--border)', flex: 1 }} />
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.16em',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function ParticipantsList({ participants }: { participants: string[] }): JSX.Element {
  if (participants.length === 0) {
    return (
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: '0.875rem',
        color: 'var(--text-secondary)',
        fontStyle: 'italic',
      }}>
        No participants identified
      </p>
    )
  }
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {participants.map((name, i) => (
        <li key={i} style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.9rem',
          color: 'var(--text-primary)',
          padding: '0.4rem 0',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
        }}>
          <span style={{
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.55rem',
            flexShrink: 0,
          }}>
            ◆
          </span>
          {name}
        </li>
      ))}
    </ul>
  )
}

function DecisionsList({ decisions }: { decisions: string[] }): JSX.Element {
  if (decisions.length === 0) {
    return (
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: '0.875rem',
        color: 'var(--text-secondary)',
        fontStyle: 'italic',
      }}>
        No decisions recorded
      </p>
    )
  }
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {decisions.map((decision, i) => (
        <li key={i} style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.9rem',
          color: 'var(--text-primary)',
          padding: '0.5rem 0.875rem',
          borderLeft: '2px solid var(--accent-border)',
          marginBottom: '0.5rem',
          lineHeight: 1.55,
          background: 'var(--accent-subtle)',
        }}>
          {decision}
        </li>
      ))}
    </ul>
  )
}

function ActionItemsTable({ actionItems }: { actionItems: ActionItem[] }): JSX.Element {
  if (actionItems.length === 0) {
    return (
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: '0.875rem',
        color: 'var(--text-secondary)',
        fontStyle: 'italic',
      }}>
        No action items
      </p>
    )
  }

  const headerCell: React.CSSProperties = {
    textAlign: 'left',
    padding: '0.5rem 0.875rem',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.58rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
    borderBottom: '1px solid var(--border-strong)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  }

  const bodyCell: React.CSSProperties = {
    padding: '0.6rem 0.875rem',
    fontFamily: 'var(--font-body)',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top',
    lineHeight: 1.5,
  }

  const mutedCell: React.CSSProperties = {
    ...bodyCell,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.78rem',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 2 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-surface)' }}>
        <thead>
          <tr>
            <th style={headerCell}>Task</th>
            <th style={headerCell}>Owner</th>
            <th style={headerCell}>Due</th>
          </tr>
        </thead>
        <tbody>
          {actionItems.map((item, i) => (
            <tr
              key={i}
              style={{ background: i % 2 !== 0 ? 'var(--row-alt)' : 'transparent' }}
            >
              <td style={bodyCell}>{item.task}</td>
              <td style={mutedCell}>{item.owner}</td>
              <td style={mutedCell}>{item.due ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SummaryContent({ result, transcript, onReset }: {
  result: SummaryResult
  transcript: string
  onReset: () => void
}): JSX.Element {
  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '2.25rem',
        animation: 'fade-up 0.45s ease-out both',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          lineHeight: 1,
          letterSpacing: '0.02em',
        }}>
          Meeting Brief
        </h2>
        <LanguageBadge language={result.language} />
      </div>

      <SectionBlock number="01" title="Overview" delay={80}>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.95rem',
          lineHeight: 1.75,
          color: 'var(--text-primary)',
          fontWeight: 300,
        }}>
          {result.summary}
        </p>
      </SectionBlock>

      <SectionBlock number="02" title="Participants" delay={160}>
        <ParticipantsList participants={result.participants} />
      </SectionBlock>

      <SectionBlock number="03" title="Decisions" delay={240}>
        <DecisionsList decisions={result.decisions} />
      </SectionBlock>

      <SectionBlock number="04" title="Action Items" delay={320}>
        <ActionItemsTable actionItems={result.action_items} />
      </SectionBlock>

      <SectionBlock number="05" title="Full Transcript" delay={400}>
        <textarea
          readOnly
          value={transcript}
          style={{
            width: '100%',
            minHeight: 200,
            padding: '1rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            lineHeight: 1.75,
            borderRadius: 2,
            border: '1px solid var(--border)',
            resize: 'vertical',
            boxSizing: 'border-box',
            background: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            outline: 'none',
          }}
        />
      </SectionBlock>

      <div style={{ animation: 'fade-up 0.5s ease-out both', animationDelay: '480ms' }}>
        <button
          onClick={onReset}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-strong)',
            borderRadius: 2,
            padding: '0.5rem 1.25rem',
            cursor: 'pointer',
          }}
        >
          New Recording
        </button>
      </div>
    </div>
  )
}

export function ResultsView({ transcript, onReset }: ResultsViewProps): JSX.Element {
  const { status, result, errorMessage, summarize } = useSummarization()

  useEffect(() => {
    summarize(transcript)
    // Run once on mount — transcript is stable for the lifetime of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'loading' || status === 'idle') {
    return (
      <div style={{ padding: '4rem 0', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          letterSpacing: '0.14em',
          color: 'var(--accent)',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
        }}>
          Analyzing with Claude<span style={{ animation: 'blink-cursor 1s step-end infinite' }}>_</span>
        </div>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.825rem',
          fontWeight: 300,
          color: 'var(--text-secondary)',
        }}>
          Generating intelligence brief — usually 5–15 seconds
        </p>
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
          Analysis Failed
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
          <button
            onClick={() => summarize(transcript)}
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
            Retry
          </button>
          <button
            onClick={onReset}
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

  return <SummaryContent result={result!} transcript={transcript} onReset={onReset} />
}
