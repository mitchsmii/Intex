import type { Resident } from "../types/Resident";
import type { Safehouse } from "../types/Safehouse";
import type { ScheduleEvent } from "../types/ScheduleEvent";
import type { ActionItem } from "../types/ActionItem";
import type { ProcessRecording } from "../types/ProcessRecording";
import type { HomeVisitation } from "../types/HomeVisitation";
import type { InterventionPlan } from "../types/InterventionPlan";
import type { IncidentReport } from "../types/IncidentReport";
import type { EducationRecord } from "../types/EducationRecord";
import type { HealthWellbeingRecord } from "../types/HealthWellbeingRecord";
import type { Assessment } from "../types/Assessment";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5280";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("cove_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function authedFetch(path: string): Promise<Response> {
  return fetch(`${API_URL}${path}`, { headers: authHeaders() });
}

export async function fetchResidents(): Promise<Resident[]> {
  const res = await authedFetch("/api/residents");
  if (!res.ok) throw new Error(`Failed to fetch residents: ${res.status}`);
  return res.json();
}

export async function fetchResident(id: number): Promise<Resident> {
  const res = await authedFetch(`/api/residents/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch resident: ${res.status}`);
  return res.json();
}

export async function fetchSafehouses(): Promise<Safehouse[]> {
  const res = await authedFetch("/api/safehouses");
  if (!res.ok) throw new Error(`Failed to fetch safehouses: ${res.status}`);
  return res.json();
}

export async function fetchProcessRecordings(params?: {
  residentId?: number;
  limit?: number;
}): Promise<ProcessRecording[]> {
  const qs = new URLSearchParams();
  if (params?.residentId) qs.set("residentId", String(params.residentId));
  if (params?.limit) qs.set("limit", String(params.limit));
  const res = await authedFetch(`/api/processrecordings?${qs}`);
  if (!res.ok) throw new Error(`Failed to fetch process recordings: ${res.status}`);
  return res.json();
}

export async function createProcessRecording(
  payload: Omit<ProcessRecording, "recordingId">
): Promise<ProcessRecording> {
  const token = localStorage.getItem("cove_token");
  const res = await fetch(`${API_URL}/api/processrecordings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = `Failed to create process recording: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = `${body.error}${body.inner ? ' — ' + body.inner : ''}`;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  return res.json();
}

export async function fetchHomeVisitations(params?: {
  residentId?: number;
  limit?: number;
}): Promise<HomeVisitation[]> {
  const qs = new URLSearchParams();
  if (params?.residentId) qs.set("residentId", String(params.residentId));
  if (params?.limit) qs.set("limit", String(params.limit));
  const res = await authedFetch(`/api/homevisitations?${qs}`);
  if (!res.ok) throw new Error(`Failed to fetch home visitations: ${res.status}`);
  return res.json();
}

export async function createHomeVisitation(
  payload: Omit<HomeVisitation, "visitationId">
): Promise<HomeVisitation> {
  const token = localStorage.getItem("cove_token");
  const res = await fetch(`${API_URL}/api/homevisitations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create home visitation: ${res.status}`);
  return res.json();
}

export async function fetchInterventionPlans(params?: {
  residentId?: number;
  status?: string;
}): Promise<InterventionPlan[]> {
  const qs = new URLSearchParams();
  if (params?.residentId) qs.set("residentId", String(params.residentId));
  if (params?.status) qs.set("status", params.status);
  const res = await authedFetch(`/api/interventionplans?${qs}`);
  if (!res.ok) throw new Error(`Failed to fetch intervention plans: ${res.status}`);
  return res.json();
}

export async function fetchIncidentReports(params?: {
  residentId?: number;
  unresolvedOnly?: boolean;
}): Promise<IncidentReport[]> {
  const qs = new URLSearchParams();
  if (params?.residentId) qs.set("residentId", String(params.residentId));
  if (params?.unresolvedOnly) qs.set("unresolvedOnly", "true");
  const res = await authedFetch(`/api/incidentreports?${qs}`);
  if (!res.ok) throw new Error(`Failed to fetch incident reports: ${res.status}`);
  return res.json();
}

export async function updateIncidentReport(
  id: number,
  payload: IncidentReport
): Promise<void> {
  const token = localStorage.getItem("cove_token");
  const res = await fetch(`${API_URL}/api/incidentreports/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update incident report: ${res.status}`);
}

export async function fetchEducationRecords(params?: {
  residentId?: number;
}): Promise<EducationRecord[]> {
  const qs = new URLSearchParams();
  if (params?.residentId) qs.set("residentId", String(params.residentId));
  const res = await authedFetch(`/api/educationrecords?${qs}`);
  if (!res.ok) throw new Error(`Failed to fetch education records: ${res.status}`);
  return res.json();
}

export async function fetchAssessments(params?: {
  residentId?: number;
  instrument?: string;
}): Promise<Assessment[]> {
  const qs = new URLSearchParams();
  if (params?.residentId) qs.set("residentId", String(params.residentId));
  if (params?.instrument) qs.set("instrument", params.instrument);
  const res = await authedFetch(`/api/assessments?${qs}`);
  if (!res.ok) throw new Error(`Failed to fetch assessments: ${res.status}`);
  return res.json();
}

export async function createAssessment(
  payload: Omit<Assessment, "assessmentId" | "createdAt">
): Promise<Assessment> {
  const token = localStorage.getItem("cove_token");
  const res = await fetch(`${API_URL}/api/assessments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = `Failed to create assessment: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json();
}

export async function fetchHealthWellbeingRecords(params?: {
  residentId?: number;
}): Promise<HealthWellbeingRecord[]> {
  const qs = new URLSearchParams();
  if (params?.residentId) qs.set("residentId", String(params.residentId));
  const res = await authedFetch(`/api/healthwellbeingrecords?${qs}`);
  if (!res.ok) throw new Error(`Failed to fetch health records: ${res.status}`);
  return res.json();
}

export async function createInterventionPlan(
  payload: Omit<InterventionPlan, "planId">
): Promise<InterventionPlan> {
  const token = localStorage.getItem("cove_token");
  const res = await fetch(`${API_URL}/api/interventionplans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create intervention plan: ${res.status}`);
  return res.json();
}

export async function updateInterventionPlan(
  id: number,
  payload: InterventionPlan
): Promise<void> {
  const token = localStorage.getItem("cove_token");
  const res = await fetch(`${API_URL}/api/interventionplans/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update intervention plan: ${res.status}`);
}

// TODO: replace with real endpoint once HomeVisit/CaseConference tables exist.
// Derives fake upcoming events from the real resident list so the dashboard feels alive.
export async function fetchUpcomingEvents(
  residents: Resident[]
): Promise<ScheduleEvent[]> {
  const sample = residents.slice(0, 5);
  const now = new Date();
  const addDays = (d: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    date.setHours(10 + (d % 6), 0, 0, 0);
    return date.toISOString();
  };
  return sample.map((r, i) => ({
    id: `mock-${r.residentId}-${i}`,
    type: i % 2 === 0 ? "HomeVisit" : "CaseConference",
    residentId: r.residentId,
    residentCode: r.internalCode ?? `#${r.residentId}`,
    date: addDays(i + 1),
    location: i % 2 === 0 ? "Family residence" : "Safehouse office",
    notes: i % 2 === 0 ? "Routine monthly check-in" : "Quarterly case review",
  }));
}

// TODO: replace with real endpoint once visit/plan tracking exists.
// Flags residents that need social-worker attention using only data we have today.
export async function fetchActionItems(
  residents: Resident[]
): Promise<ActionItem[]> {
  const items: ActionItem[] = [];
  residents.forEach((r) => {
    if (r.currentRiskLevel === "High") {
      items.push({
        residentId: r.residentId,
        residentCode: r.internalCode ?? `#${r.residentId}`,
        reason: "high-risk",
        severity: "high",
        detail: "Flagged as high risk — review case",
      });
    }
  });
  // Mock a couple of overdue visits / plan reviews from the first few residents
  residents.slice(0, 2).forEach((r, i) => {
    items.push({
      residentId: r.residentId,
      residentCode: r.internalCode ?? `#${r.residentId}`,
      reason: i === 0 ? "overdue-visit" : "plan-review",
      severity: "medium",
      detail:
        i === 0 ? "No home visit in 30+ days" : "Intervention plan due for review",
    });
  });
  return items;
}
