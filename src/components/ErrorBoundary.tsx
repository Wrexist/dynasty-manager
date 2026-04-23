import * as Sentry from '@sentry/react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { addGameBreadcrumb } from '@/utils/sentry';

interface Props {
  children: ReactNode;
  // Tag attached to telemetry so dashboards can split errors by area
  // (e.g. "app", "match", "settings", "community-pack").
  scope?: string;
  // Render-prop fallback. Receives the caught error and a `reset` callback
  // that clears the error and re-renders children.
  fallback?: (error: Error, reset: () => void) => ReactNode;
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

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', this.props.scope ?? 'unknown', error, info);
    }
    addGameBreadcrumb('crash', 'React error boundary caught', {
      scope: this.props.scope ?? 'unknown',
    });
    Sentry.captureException(error, {
      tags: { errorboundary: this.props.scope ?? 'unknown' },
      extra: { componentStack: info.componentStack },
    });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  returnToMenu = () => {
    this.reset();
    window.location.hash = '#/';
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div className="min-h-[16rem] w-full flex items-center justify-center p-6">
          <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-8 max-w-md w-full text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Your save data is safe.
            </p>
            {import.meta.env.DEV && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 font-mono break-all text-left">
                {this.state.error.message}
              </p>
            )}
            <button
              type="button"
              onClick={this.returnToMenu}
              className="px-6 py-3 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Return to Menu
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
