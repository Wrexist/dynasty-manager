import { Component, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HashRouter, Routes, Route } from "react-router-dom";
import TitleScreen from "./pages/TitleScreen";
import ClubSelection from "./pages/ClubSelection";
import GameShell from "./pages/GameShell";
import ChallengePicker from "./pages/ChallengePicker";
import NotFound from "./pages/NotFound";

// Error boundary to prevent white-screen crashes
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-8 max-w-md text-center space-y-4">
            <h1 className="text-xl font-bold text-primary">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              An unexpected error occurred. Your save data is safe.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.href = '/';
              }}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Return to Title Screen
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => (
  <ErrorBoundary>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          <Route path="/" element={<TitleScreen />} />
          <Route path="/select-club" element={<ClubSelection />} />
          <Route path="/challenge" element={<ChallengePicker />} />
          <Route path="/game" element={<GameShell />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </ErrorBoundary>
);

export default App;
