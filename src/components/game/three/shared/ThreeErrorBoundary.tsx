import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /**
   * When this value changes, the boundary resets its error state so the 3D tree
   * gets another chance to mount. Use the settings toggle (`show3DPitch` /
   * `show3DFormation`) so flipping off → on clears any prior WebGL error.
   */
  resetKey?: unknown;
}
interface State { errored: boolean }

export class ThreeErrorBoundary extends Component<Props, State> {
  state: State = { errored: false };

  static getDerivedStateFromError() {
    return { errored: true };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.errored && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ errored: false });
    }
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) console.error('[Three.js]', error);
  }

  render() {
    if (this.state.errored) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
