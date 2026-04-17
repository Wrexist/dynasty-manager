import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State { errored: boolean }

export class ThreeErrorBoundary extends Component<Props, State> {
  state: State = { errored: false };

  static getDerivedStateFromError() {
    return { errored: true };
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV !== 'production') console.error('[Three.js]', error);
  }

  render() {
    if (this.state.errored) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
