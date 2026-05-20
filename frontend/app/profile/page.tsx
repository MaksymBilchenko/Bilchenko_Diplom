"use client";

import { useEffect, useState } from "react";
import { fetchPatientAppointments, type Appointment } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorAlert } from "@/components/ui/ErrorAlert";

export default function ProfilePage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user || user.role !== "patient") return;
      try {
        const data = await fetchPatientAppointments(user.id);
        setAppointments(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  return (
    <ProtectedRoute requiredRole="patient">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-12">
          <h1 className="text-3xl font-bold text-slate-900">Мій кабінет</h1>
          <p className="mt-2 text-slate-500">Ваша історія візитів та медичні рекомендації</p>
        </header>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content: Visits & Records */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-600" />
                Найближчі та минулі візити
              </h2>

              {loading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : error ? (
                <ErrorAlert message={error} />
              ) : appointments.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400">
                  У вас ще немає записів на прийом.
                </div>
              ) : (
                <div className="space-y-4">
                  {appointments.map((appt) => (
                    <div key={appt.id} className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 transition-all hover:shadow-md">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-lg font-bold text-slate-900">
                              {new Date(appt.scheduled_start).toLocaleDateString("uk-UA", { day: 'numeric', month: 'long' })}
                            </span>
                            <span className="text-sm font-medium text-slate-400">
                              {new Date(appt.scheduled_start).toLocaleTimeString("uk-UA", { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <StatusBadge status={appt.status} />
                          </div>
                          <p className="text-slate-600 font-medium">
                            Лікар: <span className="text-slate-900">{appt.doctor?.full_name}</span> ({appt.doctor?.specialty})
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                           {/* Action Buttons could go here */}
                        </div>
                      </div>

                      {(appt.status === "completed" || appt.notes) && (
                        <div className="mt-6 pt-6 border-t border-slate-50">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Результати та призначення</h4>
                          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {appt.notes || "Результати огляду будуть доступні після завершення прийому."}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar: Profile Info & Notifications */}
          <div className="space-y-8">
            <section className="rounded-3xl bg-slate-900 p-8 text-white shadow-xl shadow-blue-200/20">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-1">{user?.name}</h3>
              <p className="text-blue-300 text-sm mb-6">{user?.email}</p>
              
              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Всього візитів</span>
                  <span className="font-bold">{appointments.length}</span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-8 border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Повідомлення
              </h3>
              <div className="space-y-4">
                <NotificationItem 
                  title="Нагадування про візит"
                  text="Ваш візит до терапевта заплановано на завтра о 09:00."
                  time="1 год тому"
                  type="info"
                />
                <NotificationItem 
                  title="Новий результат"
                  text="Доступні результати огляду від 25 квітня."
                  time="2 дні тому"
                  type="success"
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-rose-100 text-rose-700",
    no_show: "bg-slate-100 text-slate-700",
  };
  
  const labels: Record<string, string> = {
    scheduled: "Заплановано",
    completed: "Завершено",
    cancelled: "Скасовано",
    no_show: "Неявка",
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status] || styles.scheduled}`}>
      {labels[status] || status}
    </span>
  );
}

function NotificationItem({ title, text, time, type }: { title: string, text: string, time: string, type: 'info' | 'success' }) {
  return (
    <div className="group relative pl-4 border-l-2 border-slate-100 hover:border-blue-500 transition-colors">
      <h4 className="text-sm font-bold text-slate-900 mb-1">{title}</h4>
      <p className="text-xs text-slate-500 mb-2 leading-relaxed">{text}</p>
      <span className="text-[10px] font-medium text-slate-400 uppercase">{time}</span>
    </div>
  );
}
