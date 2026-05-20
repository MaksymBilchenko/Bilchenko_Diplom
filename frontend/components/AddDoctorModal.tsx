"use client";

import { useState } from "react";
import { createDoctor } from "@/lib/api";

interface AddDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddDoctorModal({ isOpen, onClose, onSuccess }: AddDoctorModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    specialty: "",
    email: "",
    password: "",
    bio: "",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createDoctor(formData);
      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Додати лікаря</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-600 border border-rose-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">ПІБ лікаря</label>
            <input
              required
              className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-blue-500 focus:ring-blue-500"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Іваненко Іван Іванович"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Спеціальність</label>
            <input
              required
              className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-blue-500 focus:ring-blue-500"
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
              placeholder="Терапевт"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
            <input
              required
              type="email"
              className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-blue-500 focus:ring-blue-500"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="doctor@med.com"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Тимчасовий пароль</label>
            <input
              required
              type="password"
              className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-blue-500 focus:ring-blue-500"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Біографія (опційно)</label>
            <textarea
              className="w-full rounded-xl border-slate-200 px-4 py-2.5 focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? "Збереження..." : "Додати"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
