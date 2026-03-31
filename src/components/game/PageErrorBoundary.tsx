import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useGameStore } from '@/store/gameStore';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, retryCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PageErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    if (this.state.retryCount >= 2) {
      // After 2 failed retries, navigate to dashboard to break the crash loop
      useGameStore.getState().setScreen('dashboard');
    }
    this.setState(prev => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }));
  };

  render() {
    if (this.state.hasError) {
      const maxRetriesReached = this.state.retryCount >= 2;
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center h-64 gap-4 px-6 text-center">
            <p className="text-lg font-semibold text-destructive">Something went wrong</p>
            <p className="text-sm text-muted-foreground">{this.state.error?.message}</p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"
            >
              {maxRetriesReached ? 'Go to Dashboard' : 'Try Again'}
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
