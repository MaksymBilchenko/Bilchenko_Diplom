/**
 * lib/api.ts — Centralized API client for the med-queue backend
 *
 * Reads NEXT_PUBLIC_API_URL from env (set in docker-compose).
 * Falls back to http://localhost:8000 for local dev outside Docker.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Types mirroring backend schemas ───────────────────────────────────────

export type AppointmentStatus =
  | "scheduled"
  | "cancelled"
  | "no_show"
  | "completed";

export type QueueStatus = "waiting" | "in_progress" | "served";

export interface Doctor {
  id: number;
  full_name: string;
  specialty: string;
}

export interface Patient {
  id: number;
  full_name: string;
  phone?: string;
  email?: string;
}

export interface Appointment {
  id: number;
  patient_id: number;
  doctor_id: number;
  scheduled_start: string; // ISO 8601
  duration_minutes?: number;
  status: AppointmentStatus;
  notes?: string;
  is_checked_in: boolean;
  doctor?: Doctor;
  patient?: Patient;
}

export interface QueueEntry {
  id: number;
  appointment_id: number;
  queue_status: QueueStatus;
  arrival_time: string;
  started_at?: string;
  finished_at?: string;
  priority: number;
  appointment?: Appointment;
}

export interface LiveQueueResponse {
  doctor_id: number;
  doctor_name: string;
  total_waiting: number;
  total_in_progress: number;
  queue: QueueEntry[];
}

// ─── API helpers ────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Exported API calls ──────────────────────────────────────────────────────

/** GET /doctors/{id}/schedule?date=YYYY-MM-DD */
export async function fetchDoctorSchedule(
  doctorId: number,
  date: string
): Promise<Appointment[]> {
  return apiFetch<Appointment[]>(
    `/doctors/${doctorId}/schedule?date=${date}`
  );
}

/** GET /queue/live/{doctor_id} */
export async function fetchLiveQueue(
  doctorId: number
): Promise<LiveQueueResponse> {
  return apiFetch<LiveQueueResponse>(`/queue/live/${doctorId}`);
}

/** POST /queue/check-in/{appointment_id}?priority=10 */
export async function checkInPatient(
  appointmentId: number,
  priority = 10
): Promise<QueueEntry> {
  return apiFetch<QueueEntry>(
    `/queue/check-in/${appointmentId}?priority=${priority}`,
    { method: "POST" }
  );
}

/** PATCH /queue/{entry_id}/status */
export async function updateQueueStatus(
  entryId: number,
  queueStatus: QueueStatus
): Promise<QueueEntry> {
  return apiFetch<QueueEntry>(`/queue/${entryId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ queue_status: queueStatus }),
  });
}

/** PATCH /api/v1/appointments/{id}/status */
export async function updateAppointment(
  appointmentId: number, 
  data: { status?: AppointmentStatus, notes?: string }
): Promise<Appointment> {
  return apiFetch<Appointment>(`/appointments/${appointmentId}/status`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** GET /api/v1/doctors/ */
export async function fetchDoctors(): Promise<Doctor[]> {
  return apiFetch<Doctor[]>("/doctors/");
}

/** GET /api/v1/appointments/patient/{id} */
export async function fetchPatientAppointments(patientId: number): Promise<Appointment[]> {
  return apiFetch<Appointment[]>(`/appointments/patient/${patientId}`);
}
/** GET /api/v1/doctors/{id}/history */
export async function fetchDoctorHistory(doctorId: number): Promise<Appointment[]> {
  return apiFetch<Appointment[]>(`/doctors/${doctorId}/history`);
}

/** POST /api/v1/appointments/ */
export async function createAppointment(data: {
  patient_id: number;
  doctor_id: number;
  scheduled_start: string;
  duration_minutes?: number;
  notes?: string;
}): Promise<Appointment> {
  return apiFetch<Appointment>("/appointments/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** POST /api/v1/doctors/ */
export async function createDoctor(data: {
  full_name: string;
  specialty: string;
  email: string;
  password: string;
  bio?: string;
}): Promise<Doctor> {
  return apiFetch<Doctor>("/doctors/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
