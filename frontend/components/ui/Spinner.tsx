"use client";

/**
 * components/ui/Spinner.tsx
 * Accessible loading spinner.
 */

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12" }[size];
  return (
    <div
      role="status"
      aria-label="Завантаження..."
      className={`${sizeClass} animate-spin rounded-full border-4 border-slate-200 border-t-blue-600`}
    />
  );
}
