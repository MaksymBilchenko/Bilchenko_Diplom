"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SchedulePanel from "@/components/SchedulePanel";
import QueueMonitor from "@/components/QueueMonitor";
import { fetchDoctors, type Doctor } from "@/lib/api";
import { AddDoctorModal } from "@/components/AddDoctorModal";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [currentDoctorId, setCurrentDoctorId] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDoctors = useCallback(async () => {
    try {
      const data = await fetchDoctors();
      setDoctors(data);
      if (data.length > 0) {
        if (user?.role === "doctor") {
          setCurrentDoctorId(user.id);
        } else if (!currentDoctorId) {
          setCurrentDoctorId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load doctors", err);
    }
  }, [user, currentDoctorId]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const selectedDoctor = doctors.find(d => d.id === currentDoctorId);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => setIsRefreshing(false), 800);
  }, []);

  const handleCheckedIn = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <ProtectedRoute requiredRole="staff">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Dashboard Actions & Info */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Дашборд реєстратора
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Керування чергою та записами пацієнтів
            </p>
          </div>

          <div className="flex items-center gap-4">
            {user?.role === "admin" && (
              <>
                <div className="hidden border-r border-slate-200 pr-4 sm:block text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 pl-1">Поточний лікар</p>
                  <div className="relative group">
                    <select 
                      value={currentDoctorId || ""}
                      onChange={(e) => setCurrentDoctorId(Number(e.target.value))}
                      className="appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none transition-all hover:border-blue-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 cursor-pointer"
                    >
                      {doctors.map(d => (
                        <option key={d.id} value={d.id}>{d.full_name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 group-hover:text-blue-500 transition-colors">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <Link
                  href="/dashboard/doctors"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
                >
                  <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Список лікарів
                </Link>

                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
                >
                  <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Додати лікаря
                </button>
              </>
            )}

            {user?.role === "doctor" && selectedDoctor && (
               <div className="hidden border-r border-slate-200 pr-4 text-right sm:block">
                 <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Поточний лікар</p>
                 <p className="text-sm font-bold text-slate-700">{selectedDoctor.full_name}</p>
               </div>
            )}

            <Link
              href="/dashboard/history"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Історія прийомів
            </Link>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 hover:shadow-blue-300 active:scale-95 disabled:opacity-50"
            >
              <svg
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Оновити дані
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_400px]">
          <section aria-labelledby="schedule-heading">
            <SectionHeader
              id="schedule-heading"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                />
              }
              title="Заплановані візити на сьогодні"
              subtitle="Натисніть «Зареєструвати прибуття», коли пацієнт прийде"
              accentColor="blue"
            />
            <div className="mt-4">
              {currentDoctorId && (
                <SchedulePanel
                  key={`schedule-${currentDoctorId}-${refreshKey}`}
                  doctorId={currentDoctorId}
                  onCheckedIn={handleCheckedIn}
                />
              )}
            </div>
          </section>

          <section aria-labelledby="queue-heading">
            <SectionHeader
              id="queue-heading"
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              }
              title="Жива черга"
              subtitle="Пацієнти, що зараз очікують у клініці"
              accentColor="violet"
            />
            <div className="mt-4">
              {currentDoctorId && (
                <QueueMonitor
                  key={`queue-${currentDoctorId}-${refreshKey}`}
                  doctorId={currentDoctorId}
                />
              )}
            </div>
          </section>
        </div>

        <AddDoctorModal 
          isOpen={isAddModalOpen} 
          onClose={() => setIsAddModalOpen(false)} 
          onSuccess={() => {
            loadDoctors();
            handleRefresh();
          }}
        />
      </div>
    </ProtectedRoute>
  );
}

interface SectionHeaderProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accentColor: "blue" | "violet";
}

function SectionHeader({
  id,
  icon,
  title,
  subtitle,
  accentColor,
}: SectionHeaderProps) {
  const iconBg =
    accentColor === "blue" ? "bg-blue-100 text-blue-600" : "bg-violet-100 text-violet-600";

  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          {icon}
        </svg>
      </div>
      <div>
        <h2 id={id} className="text-base font-bold text-slate-800">
          {title}
        </h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}
