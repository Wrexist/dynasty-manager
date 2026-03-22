import { Component, type ReactNode } from 'react';
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

  handleReturnToDashboard = () => {
    useGameStore.getState().setScreen('dashboard');
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-8 max-w-md w-full text-center space-y-4">
            <div className="text-4xl">⚠</div>
            <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. You can return to the dashboard and continue playing.
            </p>
            {this.state.error && (
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
