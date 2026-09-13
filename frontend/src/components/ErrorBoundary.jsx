import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-paper p-4">
          <div className="max-w-md w-full text-center p-8 card border border-red-200 bg-red-50">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-display mb-2 text-red-700">Something went wrong.</h1>
            <p className="text-red-600/80 mb-8 text-sm break-words">{this.state.error?.toString()}</p>
            <button onClick={() => window.location.reload()} className="btn-primary bg-red-600 hover:bg-red-700">Reload Page</button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}
