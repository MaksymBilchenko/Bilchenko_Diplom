"use client";

/**
 * components/QueueMonitor.tsx
 *
 * Displays the live queue for a given doctor.
 * - Polls the API every 15 seconds for real-time updates.
 * - Shows waiting and in-progress patients as cards.
 * - Allows the registrar to advance patient status (Call → Complete).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchLiveQueue,
  updateQueueStatus,
  type LiveQueueResponse,
  type QueueEntry,
  type QueueStatus,
} from "@/lib/api";
import {
  fmtTime,
  QUEUE_STATUS_LABEL,
  QUEUE_STATUS_COLOR,
  priorityLabel,
} from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PatientCardModal } from "@/components/PatientCardModal";
import { type Appointment } from "@/lib/api";

const POLL_INTERVAL_MS = 15_000;

interface QueueMonitorProps {
  doctorId: number;
}

export default function QueueMonitor({ doctorId }: QueueMonitorProps) {
  const [data, setData] = useState<LiveQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null); // entry id
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchLiveQueue(doctorId);
      setData(result);
      setError(null);
    } catch (err) {
      setError((err as Error).message ?? "Не вдалося завантажити чергу");
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  // Initial load + polling
  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  const handleStatusChange = async (entry: QueueEntry, next: QueueStatus) => {
    setActionLoading(entry.id);
    try {
      await updateQueueStatus(entry.id, next);
      await load(); // refresh immediately
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !data) {
    return <ErrorAlert message={error} onRetry={load} />;
  }

  const queue = data?.queue ?? [];

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex flex-wrap items-center gap-4">
        <StatPill
          value={data?.total_waiting ?? 0}
          label="Очікують"
          color="sky"
        />
        <StatPill
          value={data?.total_in_progress ?? 0}
          label="На прийомі"
          color="violet"
        />
        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          Оновлення кожні {POLL_INTERVAL_MS / 1000} с
          {loading && <span className="ml-1 animate-pulse">●</span>}
        </span>
      </div>

      {/* Error banner (non-blocking: data still visible) */}
      {error && <ErrorAlert message={error} onRetry={load} />}

      {/* Empty state */}
      {queue.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg
              className="h-6 w-6 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-500">
            Черга порожня
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Зареєструйте прибуття пацієнта у розкладі нижче
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {queue.map((entry, idx) => (
            <QueueCard
              key={entry.id}
              entry={entry}
              position={idx + 1}
              isActionLoading={actionLoading === entry.id}
              onStatusChange={handleStatusChange}
              handleOpenCard={(appt) => setSelectedAppointment(appt)}
            />
          ))}
        </ul>
      )}

      {selectedAppointment && (
        <PatientCardModal 
          appointment={selectedAppointment} 
          onClose={() => setSelectedAppointment(null)}
          onSave={(updated) => {
            // Update local state if needed or refresh queue
            load();
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: "sky" | "violet";
}) {
  const cls =
    color === "sky"
      ? "bg-sky-50 border-sky-200 text-sky-700"
      : "bg-violet-50 border-violet-200 text-violet-700";

  return (
    <div className={`flex items-center gap-2 rounded-xl border px-4 py-2 ${cls}`}>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

function QueueCard({
  entry,
  position,
  isActionLoading,
  onStatusChange,
  handleOpenCard,
}: {
  entry: QueueEntry;
  position: number;
  isActionLoading: boolean;
  onStatusChange: (entry: QueueEntry, next: QueueStatus) => void;
  handleOpenCard?: (appt: Appointment) => void;
}) {
  const patientName =
    entry.appointment?.patient?.full_name ?? `Пацієнт #${entry.appointment_id}`;
  const prio = priorityLabel(entry.priority);
  const isWaiting = entry.queue_status === "waiting";
  const isInProgress = entry.queue_status === "in_progress";

  return (
    <li
      className={`group relative rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
        isInProgress ? "border-violet-300 ring-1 ring-violet-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Position number */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            isInProgress
              ? "bg-violet-100 text-violet-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {position}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">{patientName}</p>
            <StatusBadge
              label={QUEUE_STATUS_LABEL[entry.queue_status]}
              colorClass={QUEUE_STATUS_COLOR[entry.queue_status]}
            />
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${prio.cls}`}>
              {prio.label}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>
              <span className="font-medium text-slate-600">Прибув:</span>{" "}
              {fmtTime(entry.arrival_time)}
            </span>
            {entry.started_at && (
              <span>
                <span className="font-medium text-slate-600">Викликано:</span>{" "}
                {fmtTime(entry.started_at)}
              </span>
            )}
            {entry.appointment?.scheduled_start && (
              <span>
                <span className="font-medium text-slate-600">Запис:</span>{" "}
                {fmtTime(entry.appointment.scheduled_start)}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="shrink-0 flex items-center gap-2">
          {isInProgress && entry.appointment && handleOpenCard && (
            <button
              onClick={() => handleOpenCard(entry.appointment!)}
              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 transition hover:bg-blue-100 active:scale-95"
              title="Відкрити медичну картку"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Картка
            </button>
          )}

          {isActionLoading ? (
            <Spinner size="sm" />
          ) : isWaiting ? (
            <button
              onClick={() => onStatusChange(entry, "in_progress")}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 active:scale-95"
            >
              Викликати
            </button>
          ) : isInProgress ? (
            <button
              onClick={() => onStatusChange(entry, "served")}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
            >
              Завершити
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
