"use client";

/**
 * components/ui/ErrorAlert.tsx
 * Inline error message block.
 */

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
      {/* Icon */}
      <svg
        className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>
      <div className="flex-1">
        <p className="text-sm font-medium text-red-700">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-800 underline"
        >
          Повторити
        </button>
      )}
    </div>
  );
}
