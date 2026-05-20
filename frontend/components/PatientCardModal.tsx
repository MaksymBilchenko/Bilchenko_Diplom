"use client";

import { useState, useEffect } from "react";
import { updateAppointment, type Appointment } from "@/lib/api";
import { Spinner } from "./ui/Spinner";

interface PatientCardModalProps {
  appointment: Appointment;
  onClose: () => void;
  onSave?: (updated: Appointment) => void;
}

export function PatientCardModal({ appointment, onClose, onSave }: PatientCardModalProps) {
  const [notes, setNotes] = useState(appointment.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await updateAppointment(appointment.id, { notes });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      if (onSave) onSave(updated);
    } catch (err) {
      alert("Помилка збереження: " + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl shadow-slate-900/20 border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Медична картка</h2>
            <p className="text-sm text-slate-500">Пацієнт: <span className="font-bold text-slate-700">{appointment.patient?.full_name}</span></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-200 text-slate-400 transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1">Дата візиту</p>
              <p className="text-sm font-bold text-blue-900">
                {new Date(appointment.scheduled_start).toLocaleDateString("uk-UA", { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Телефон</p>
              <p className="text-sm font-bold text-slate-900">{appointment.patient?.phone || "Не вказано"}</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-700">Результати огляду та призначення</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Введіть скарги, діагноз, призначення ліків або направлення на аналізи..."
              className="w-full h-64 rounded-2xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-sm leading-relaxed p-4 transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {success && (
              <span className="text-emerald-600 text-sm font-bold flex items-center gap-1 animate-in slide-in-from-left-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Збережено
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-all"
            >
              Скасувати
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70"
            >
              {isSaving ? <Spinner size="sm" color="white" /> : "Зберегти зміни"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
