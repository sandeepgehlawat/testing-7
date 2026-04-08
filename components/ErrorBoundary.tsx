"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }
  componentDidCatch(err: Error) {
    if (typeof console !== "undefined") console.error("[ErrorBoundary]", err);
  }
  reset = () => this.setState({ hasError: false, message: undefined });
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-loss/30 bg-loss/5 p-6 text-center">
          <AlertTriangle size={28} className="text-loss mx-auto mb-2" />
          <div className="font-semibold text-ink">Something went wrong</div>
          <div className="text-xs text-sub mt-1 break-all">{this.state.message}</div>
          <button
            onClick={this.reset}
            className="mt-4 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-white border border-line text-ink text-xs font-semibold hover:border-brand-300 hover:text-brand-700 transition"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
