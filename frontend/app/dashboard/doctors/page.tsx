"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchDoctors, type Doctor } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AddDoctorModal } from "@/components/AddDoctorModal";
import Link from "next/link";

export default function DoctorsAdminPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadDoctors = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchDoctors();
      setDoctors(data);
    } catch (err) {
      console.error("Failed to load doctors", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const filteredDoctors = doctors.filter(
    (d) =>
      d.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Керування лікарями
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Список усіх спеціалістів клініки та їх контактна інформація
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              До дашборду
            </Link>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Додати лікаря
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="relative max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              className="block w-full rounded-xl border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
              placeholder="Пошук лікаря за ім'ям, спеціальністю або email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Doctors Table/Grid */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600/30 border-t-blue-600"></div>
              <p className="text-sm font-medium text-slate-500">Завантаження списку лікарів...</p>
            </div>
          </div>
        ) : filteredDoctors.length > 0 ? (
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Лікар</th>
                    <th className="px-6 py-4">Спеціальність</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Біографія</th>
                    <th className="px-6 py-4 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDoctors.map((doctor) => (
                    <tr key={doctor.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                            {doctor.full_name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                          </div>
                          <span className="font-bold text-slate-900">{doctor.full_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          {doctor.specialty}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {doctor.email}
                      </td>
                      <td className="px-6 py-4">
                        <p className="max-w-xs truncate text-sm text-slate-500" title={doctor.bio}>
                          {doctor.bio || "Інформація відсутня"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white py-16 px-4 text-center shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 rounded-2xl bg-slate-50 p-4">
              <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Лікарів не знайдено</h3>
            <p className="mt-1 text-slate-500">Спробуйте змінити параметри пошуку або додайте нового спеціаліста.</p>
          </div>
        )}

        <AddDoctorModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={loadDoctors}
        />
      </div>
    </ProtectedRoute>
  );
}
