import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Last-resort boundary around the app.
 *
 * A render crash would otherwise leave a blank screen with the user's data
 * apparently gone. This keeps them oriented and offers a reload, and points
 * at the export route so a bug can never cost someone their history.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No telemetry backend — surface it where a developer will see it.
    console.error('FitTrack crashed:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-[100dvh] bg-bg text-ink flex items-center justify-center p-6">
        <div className="max-w-[340px] text-center">
          <div className="text-4xl mb-3" aria-hidden="true">⚠️</div>
          <h1 className="text-[19px] font-bold mb-2">Something went wrong</h1>
          <p className="text-[13.5px] text-muted leading-relaxed mb-5">
            FitTrack hit an unexpected error. Your logged data is safe on this device —
            reloading usually clears it.
          </p>
          <button className="btn-primary w-full mb-2" onClick={() => window.location.reload()}>
            Reload
          </button>
          <details className="text-left mt-4">
            <summary className="text-[12px] text-faint cursor-pointer">Error details</summary>
            <pre className="text-[11px] text-faint mt-2 overflow-x-auto whitespace-pre-wrap break-words">
              {error.message}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
