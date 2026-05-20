"use client";

/**
 * components/SchedulePanel.tsx
 *
 * Displays today's scheduled appointments for a doctor.
 * Allows registrar to check-in a patient (POST /queue/check-in/{id}).
 * After check-in the row updates immediately and calls onCheckedIn
 * so the parent can refresh the QueueMonitor.
 */

import { useCallback, useEffect, useState } from "react";
import {
  checkInPatient,
  fetchDoctorSchedule,
  type Appointment,
} from "@/lib/api";
import {
  fmtTime,
  todayISO,
  APPT_STATUS_LABEL,
  APPT_STATUS_COLOR,
} from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface SchedulePanelProps {
  doctorId: number;
  /** Called after successful check-in so parent can refresh queue */
  onCheckedIn?: () => void;
}

export default function SchedulePanel({
  doctorId,
  onCheckedIn,
}: SchedulePanelProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState<number | null>(null);
  const [checkedInIds, setCheckedInIds] = useState<Set<number>>(new Set());

  const today = todayISO();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDoctorSchedule(doctorId, today);
      setAppointments(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message ?? "Не вдалося завантажити розклад");
    } finally {
      setLoading(false);
    }
  }, [doctorId, today]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCheckIn = async (appt: Appointment) => {
    setCheckingIn(appt.id);
    try {
      await checkInPatient(appt.id);
      setCheckedInIds((prev) => new Set(prev).add(appt.id));
      onCheckedIn?.();
    } catch (err) {
      alert(`Помилка реєстрації: ${(err as Error).message}`);
    } finally {
      setCheckingIn(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={load} />;
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 py-14 text-center">
        <p className="text-sm font-medium text-slate-500">
          Записів на сьогодні немає
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <Th>Час</Th>
            <Th>Пацієнт</Th>
            <Th>Тривалість</Th>
            <Th>Статус</Th>
            <Th>Нотатки</Th>
            <Th>
              <span className="sr-only">Дії</span>
            </Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {appointments.map((appt) => {
            const alreadyCheckedIn = checkedInIds.has(appt.id);
            const canCheckIn =
              appt.status === "scheduled" && !alreadyCheckedIn;

            return (
              <tr
                key={appt.id}
                className="transition-colors hover:bg-slate-50"
              >
                {/* Time */}
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-slate-700">
                  {fmtTime(appt.scheduled_start)}
                </td>

                {/* Patient */}
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">
                    {appt.patient?.full_name ?? `Пацієнт #${appt.patient_id}`}
                  </p>
                  {appt.patient?.phone && (
                    <p className="text-xs text-slate-400">
                      {appt.patient.phone}
                    </p>
                  )}
                </td>

                {/* Duration */}
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {appt.duration_minutes ?? 30} хв
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <StatusBadge
                    label={
                      alreadyCheckedIn
                        ? "Зареєстровано"
                        : APPT_STATUS_LABEL[appt.status]
                    }
                    colorClass={
                      alreadyCheckedIn
                        ? "bg-emerald-100 text-emerald-700"
                        : APPT_STATUS_COLOR[appt.status]
                    }
                  />
                </td>

                {/* Notes */}
                <td className="max-w-[160px] truncate px-4 py-3 text-xs text-slate-400">
                  {appt.notes ?? "—"}
                </td>

                <td className="px-4 py-3 text-right">
                  {checkingIn === appt.id ? (
                    <div className="flex justify-end pr-8">
                      <Spinner size="sm" />
                    </div>
                  ) : (appt.is_checked_in || alreadyCheckedIn) ? (
                    <button
                      disabled
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400 cursor-not-allowed border border-slate-200"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                      У черзі
                    </button>
                  ) : appt.status === "scheduled" ? (
                    <button
                      onClick={() => handleCheckIn(appt)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-95 active:shadow-inner"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 4.5v15m7.5-7.5h-15"
                        />
                      </svg>
                      Зареєструвати прибуття
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}
