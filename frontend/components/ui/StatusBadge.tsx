"use client";

/**
 * components/ui/StatusBadge.tsx
 * Reusable colored pill badge for appointment/queue statuses.
 */

interface StatusBadgeProps {
  label: string;
  colorClass: string;
}

export function StatusBadge({ label, colorClass }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}
    >
      {label}
    </span>
  );
}
