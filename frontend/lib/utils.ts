/**
 * lib/utils.ts — Shared formatting utilities
 */

/** Format ISO datetime to locale time HH:MM */
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format ISO datetime to locale date DD.MM.YYYY */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("uk-UA");
}

/** Today as YYYY-MM-DD */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Ukrainian labels for statuses */
export const APPT_STATUS_LABEL: Record<string, string> = {
  scheduled: "Заплановано",
  cancelled: "Скасовано",
  no_show: "Неявка",
  completed: "Завершено",
};

export const QUEUE_STATUS_LABEL: Record<string, string> = {
  waiting: "Очікує",
  in_progress: "На прийомі",
  served: "Обслужено",
};

/** Tailwind color classes per status */
export const APPT_STATUS_COLOR: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-600",
  no_show: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
};

export const QUEUE_STATUS_COLOR: Record<string, string> = {
  waiting: "bg-sky-100 text-sky-700",
  in_progress: "bg-violet-100 text-violet-700",
  served: "bg-emerald-100 text-emerald-700",
};

/** Priority label */
export function priorityLabel(p: number): { label: string; cls: string } {
  if (p <= 2) return { label: "Екстрений", cls: "bg-red-500 text-white" };
  if (p <= 5) return { label: "Терміновий", cls: "bg-amber-400 text-white" };
  return { label: "Стандарт", cls: "bg-slate-200 text-slate-600" };
}
