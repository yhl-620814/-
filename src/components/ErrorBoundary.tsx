import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || '系統發生非預期的錯誤，請重新整理頁面再試一次。',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendlyMessage = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; operationType?: string };
        if (parsed.error) {
          friendlyMessage = `資料庫存取權限或連線異常（${parsed.operationType || 'read'}）：${parsed.error}`;
        }
      } catch {
        // Keep raw message if not JSON
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
            <div className="flex items-center gap-3 text-red-700 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-semibold text-slate-900">系統載入發生錯誤</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-6 break-words">
              {friendlyMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4" />
              重新整理頁面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
