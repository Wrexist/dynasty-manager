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

  render() {
    if (this.state.errored) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
