import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[STONE] App crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4"
          style={{ background: '#302b26' }}>
          <img src="/logo.png" alt="STONE" className="h-32 object-contain" />
          <div className="flex flex-col items-center gap-3 bg-[#504840] border-2 border-[#6b5f55] rounded-xl p-6 shadow-lg max-w-sm w-full text-center">
            <p className="text-white font-heading text-lg">Something went wrong</p>
            <p className="text-white/60 text-sm">The game encountered an error. Try refreshing the page.</p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="px-6 py-3 rounded-xl font-heading text-sm uppercase tracking-wider
                         bg-amber-600 text-white border-2 border-amber-500
                         hover:bg-amber-500 cursor-pointer shadow-lg mt-2"
            >
              Refresh
            </button>
            <a href="mailto:support@stonethegame.com"
              className="text-white/40 text-xs hover:text-white/70 transition-colors mt-2">
              Contact Support
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
