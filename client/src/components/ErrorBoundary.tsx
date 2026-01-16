import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Component, ReactNode, ErrorInfo } from "react";
import { captureException, addBreadcrumb } from "@/lib/sentry";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to Sentry
    captureException(error, {
      componentStack: errorInfo.componentStack,
    });

    // Add breadcrumb for debugging
    addBreadcrumb({
      category: 'error-boundary',
      message: `Error caught: ${error.message}`,
      level: 'error',
      data: {
        componentStack: errorInfo.componentStack?.slice(0, 500),
      },
    });

    // Update state with error info
    this.setState({ errorInfo });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('Error caught by ErrorBoundary:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8 space-y-6">
            <div className="p-4 bg-destructive/10 rounded-full">
              <AlertTriangle
                size={48}
                className="text-destructive"
              />
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Something went wrong</h2>
              <p className="text-muted-foreground">
                An unexpected error occurred. Our team has been notified.
              </p>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <div className="p-4 w-full rounded bg-muted overflow-auto max-h-48">
                <p className="font-mono text-sm text-destructive mb-2">
                  {this.state.error.message}
                </p>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {this.state.errorInfo?.componentStack?.slice(0, 500)}
                </pre>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={this.handleRetry} variant="default">
                <RotateCcw size={16} className="mr-2" />
                Try Again
              </Button>
              <Button onClick={this.handleGoHome} variant="outline">
                <Home size={16} className="mr-2" />
                Go to Dashboard
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              If this problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
