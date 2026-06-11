import * as Sentry from '@sentry/react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Mirror the capture in src/components/ErrorBoundary.tsx — previously
    // this in-game variant swallowed errors silently, so a crash that
    // bubbled past PageErrorBoundary into this outer boundary was
    // invisible to triage. Sentry receives the React component stack
    // alongside the JS error.
    Sentry.captureException(error, {
      tags: { context: 'game-error-boundary' },
      extra: { componentStack: info.componentStack },
    });
  }

  handleReturnToDashboard = () => {
    const state = useGameStore.getState();
    state.cleanupAbandonedMatch();
    state.setScreen('dashboard');
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-8 max-w-md w-full text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. You can return to the dashboard and continue playing.
            </p>
            {/* Raw error internals are dev-only — mirrors the root ErrorBoundary. */}
            {import.meta.env.DEV && this.state.error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReturnToDashboard}
              className="px-6 py-3 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
