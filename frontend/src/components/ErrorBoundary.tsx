import { Component, ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-primary)' }}>
          <h2>Something went wrong</h2>
          <p>The application encountered an unexpected error.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '0.5rem 1.25rem', cursor: 'pointer' }}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
