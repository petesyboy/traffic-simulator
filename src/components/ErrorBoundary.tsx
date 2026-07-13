import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught an error in ${this.props.name || 'Component'}:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{
          padding: '16px',
          background: '#1a1010',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          color: '#fca5a5',
          fontFamily: 'sans-serif',
          fontSize: '12px',
          margin: '10px'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#f87171', fontWeight: 'bold' }}>
            Something went wrong in {this.props.name || 'this panel'}
          </h4>
          <p style={{ margin: '0 0 12px 0', opacity: 0.9 }}>
            An unexpected error occurred during rendering.
          </p>
          {this.state.error && (
            <pre style={{
              background: '#0a0505',
              padding: '8px',
              borderRadius: '4px',
              overflowX: 'auto',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#f87171',
              border: '1px solid #7f1d1d'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
