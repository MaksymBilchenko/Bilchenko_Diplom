"use client";

import { useEffect, useState } from "react";
import { fetchDoctors, createAppointment, type Doctor } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorAlert } from "@/components/ui/ErrorAlert";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";

export default function BookingPage() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);
  const [step, setStep] = useState(1); // 1: Select Doctor, 2: Select Time, 3: Success

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchDoctors();
        setDoctors(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleTimeSelect = async (time: string) => {
    if (!selectedDoctor || !user) return;
    setBookingLoading(true);
    setError(null);
    try {
      const today = new Date();
      const [hours, minutes] = time.split(":");
      today.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      
      await createAppointment({
        patient_id: user.id,
        doctor_id: selectedDoctor,
        scheduled_start: today.toISOString(),
        duration_minutes: 30,
      });
      setStep(3);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (error) return <div className="max-w-7xl mx-auto p-8"><ErrorAlert message={error} /></div>;

  return (
    <ProtectedRoute requiredRole="patient">
      <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold text-slate-900">Запис на прийом</h1>
        <p className="mt-2 text-slate-500">Оберіть спеціаліста та зручний час для візиту</p>
      </div>

      {/* Progress Stepper */}
      <div className="mb-12 flex justify-center">
        <div className="flex items-center gap-4">
          <StepCircle num={1} active={step >= 1} label="Лікар" />
          <div className={`h-0.5 w-12 ${step >= 2 ? "bg-blue-600" : "bg-slate-200"}`} />
          <StepCircle num={2} active={step >= 2} label="Час" />
          <div className={`h-0.5 w-12 ${step >= 3 ? "bg-blue-600" : "bg-slate-200"}`} />
          <StepCircle num={3} active={step >= 3} label="Готово" />
        </div>
      </div>

      {step === 1 && (
        <div className="grid gap-6 sm:grid-cols-2">
          {doctors.map((doc) => (
            <button
              key={doc.id}
              onClick={() => {
                setSelectedDoctor(doc.id);
                setStep(2);
              }}
              className={`flex flex-col items-start rounded-2xl border-2 p-6 text-left transition-all hover:border-blue-300 hover:bg-blue-50/30 ${
                selectedDoctor === doc.id ? "border-blue-600 bg-blue-50 ring-4 ring-blue-50" : "border-slate-100 bg-white"
              }`}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{doc.full_name}</h3>
              <p className="text-sm font-medium text-blue-600">{doc.specialty}</p>
              <div className="mt-4 flex items-center text-xs text-slate-400">
                <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Доступно сьогодні
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/50 border border-slate-100 text-center">
          <h3 className="text-xl font-bold mb-6">Оберіть час</h3>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {["09:00", "09:30", "10:00", "11:30", "14:00", "16:30"].map(time => (
              <button 
                key={time}
                onClick={() => handleTimeSelect(time)}
                disabled={bookingLoading}
                className="py-3 px-4 rounded-xl border border-slate-200 hover:border-blue-600 hover:text-blue-600 font-medium transition-colors disabled:opacity-50"
              >
                {time}
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} className="text-slate-400 text-sm font-medium hover:text-slate-600">
            ← Назад до вибору лікаря
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-3xl bg-white p-12 shadow-xl shadow-slate-200/50 border border-slate-100 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-6">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Запис підтверджено!</h2>
          <p className="text-slate-500 mb-8">Ми надіслали деталі візиту на вашу електронну пошту.</p>
          <button 
            onClick={() => window.location.href = "/profile"}
            className="rounded-xl bg-slate-900 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800"
          >
            У кабінет
          </button>
        </div>
      )}
      </div>
    </ProtectedRoute>
  );
}

function StepCircle({ num, active, label }: { num: number, active: boolean, label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
        active ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-100" : "border-slate-200 text-slate-400"
      }`}>
        {num}
      </div>
      <span className={`text-xs font-bold uppercase tracking-wider ${active ? "text-blue-600" : "text-slate-400"}`}>
        {label}
      </span>
    </div>
  );
}
