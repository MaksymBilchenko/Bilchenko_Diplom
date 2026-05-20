"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchDoctorHistory, type Appointment } from "@/lib/api";
import { fmtDate, fmtTime, APPT_STATUS_LABEL, APPT_STATUS_COLOR } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function DoctorHistoryPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Якщо це адмін, він може бачити історію певного лікаря (поки по замовчуванню ID=1)
      // Якщо лікар - бачить свою історію
      const targetId = user.role === "doctor" ? user.id : 1;
      const data = await fetchDoctorHistory(targetId);
      setAppointments(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) =>
      a.patient?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [appointments, searchTerm]);

  return (
    <ProtectedRoute requiredRole="staff">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link 
            href="/dashboard" 
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Назад до дашборду
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Історія прийомів
          </h1>
          <p className="mt-1 text-slate-500">
            Перегляд усіх пацієнтів та медичних записів
          </p>
        </div>

        <div className="relative flex-1 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Пошук за ім'ям пацієнта або нотатками..."
            className="block w-full rounded-2xl border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm transition-focus focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <ErrorAlert message={error} onRetry={load} />
      ) : filteredAppointments.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 py-20 text-center">
          <p className="text-slate-500">Записів не знайдено</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredAppointments.map((appt) => (
            <div 
              key={appt.id}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex flex-col md:flex-row">
                {/* Date/Time column */}
                <div className="bg-slate-50 p-6 md:w-48 md:border-r md:border-slate-100 flex flex-col justify-center items-center text-center">
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{fmtDate(appt.scheduled_start)}</span>
                  <span className="text-2xl font-black text-slate-800">{fmtTime(appt.scheduled_start)}</span>
                  <div className="mt-3">
                    <StatusBadge 
                      label={APPT_STATUS_LABEL[appt.status]} 
                      colorClass={APPT_STATUS_COLOR[appt.status]} 
                    />
                  </div>
                </div>

                {/* Content column */}
                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        {appt.patient?.full_name}
                      </h3>
                      <div className="mt-1 flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {appt.patient?.email || "Email не вказано"}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {appt.patient?.phone || "Телефон не вказано"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Медичні нотатки та призначення:</h4>
                    <div className="mt-2 rounded-2xl bg-blue-50/50 p-4 ring-1 ring-blue-100/50">
                      {appt.notes ? (
                        <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                          {appt.notes}
                        </p>
                      ) : (
                        <p className="italic text-sm text-slate-400">Нотатки відсутні</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </ProtectedRoute>
  );
}
