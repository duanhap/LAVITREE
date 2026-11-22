import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState } from './ErrorState';

export interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({
        hasError: false,
        error: null,
      });
    }
  }

  private isChunkLoadError(error: Error | null): boolean {
    if (!error) return false;
    if (error.name === 'ChunkLoadError') return true;
    const msg = error.message?.toLowerCase() || '';
    return (
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('importing a module script failed') ||
      msg.includes('error loading dynamically imported module')
    );
  }

  private handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isChunkError = this.isChunkLoadError(this.state.error);

      if (isChunkError) {
        return (
          <div className="py-12">
            <ErrorState
              title="Đã có phiên bản mới"
              message="Trang vừa được cập nhật. Bấm tải lại để dùng bản mới."
              onRetry={() => window.location.reload()}
              retryText="Tải lại trang"
            />
          </div>
        );
      }

      return (
        <div className="py-12 flex flex-col items-center">
          <ErrorState
            title="Trang này gặp lỗi hiển thị"
            message="Bạn thử tải lại. Nếu vẫn lỗi, hãy quay về trang chủ."
            onRetry={this.handleRetry}
            retryText="Thử lại"
          />
          <div className="-mt-3 mb-6">
            <Link to="/" className="text-sm font-medium text-primary hover:underline">
              Về trang chủ
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
