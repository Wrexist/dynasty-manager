import * as Sentry from '@sentry/react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { addGameBreadcrumb } from '@/utils/sentry';
import { track } from '@/utils/analytics';

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
  // Counts how many times this boundary has caught. "Return to Menu" only
  // clears the error and re-renders the same subtree, so a DETERMINISTIC
  // crash (e.g. a corrupt save slot the menu tries to render) re-throws
  // immediately and the user is trapped in an identical reset→re-crash loop.
  // Once we've caught repeatedly we escalate to a hard reload, which the
  // default fallback surfaces as the primary action.
  retryCount: number;
}

// After this many catches, the menu-reset clearly isn't recovering — offer a
// full reload (re-runs storage hydration / SaveRecoveryDialog) instead.
const PERSISTENT_ERROR_THRESHOLD = 2;

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, retryCount: 0 };

  // Partial return — React merges it, so retryCount (bumped in
  // componentDidCatch) survives across a reset→re-catch cycle.
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', this.props.scope ?? 'unknown', error, info);
    }
    this.setState(s => ({ retryCount: s.retryCount + 1 }));
    addGameBreadcrumb('crash', 'React error boundary caught', {
      scope: this.props.scope ?? 'unknown',
      retryCount: this.state.retryCount + 1,
    });
    track('crash', { category: `error_boundary:${this.props.scope ?? 'unknown'}` });
    Sentry.captureException(error, {
      tags: { errorboundary: this.props.scope ?? 'unknown' },
      extra: { componentStack: info.componentStack, retryCount: this.state.retryCount + 1 },
    });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  returnToMenu = () => {
    this.reset();
    window.location.hash = '#/';
  };

  reloadApp = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      const persistent = this.state.retryCount >= PERSISTENT_ERROR_THRESHOLD;
      return (
        <div className="min-h-[16rem] w-full flex items-center justify-center p-6">
          <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-8 max-w-md w-full text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              {persistent
                ? "This screen keeps failing to load. Reloading the app usually clears it — your save data is safe."
                : 'An unexpected error occurred. Your save data is safe.'}
            </p>
            {/* Surface the message on a persistent failure even in production —
                the user is stuck and it helps them report the issue. */}
            {(import.meta.env.DEV || persistent) && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 font-mono break-all text-left">
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={persistent ? this.reloadApp : this.returnToMenu}
                className="px-6 py-3 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                {persistent ? 'Reload App' : 'Return to Menu'}
              </button>
              {persistent && (
                <button
                  type="button"
                  onClick={this.returnToMenu}
                  className="px-6 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  Return to Menu
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
