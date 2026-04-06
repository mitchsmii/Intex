import type { Resident } from "../types/Resident";
import type { Safehouse } from "../types/Safehouse";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5280";

export async function fetchResidents(): Promise<Resident[]> {
  const res = await fetch(`${API_URL}/api/residents`);
  if (!res.ok) throw new Error(`Failed to fetch residents: ${res.status}`);
  return res.json();
}

export async function fetchResident(id: number): Promise<Resident> {
  const res = await fetch(`${API_URL}/api/residents/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch resident: ${res.status}`);
  return res.json();
}

export async function fetchSafehouses(): Promise<Safehouse[]> {
  const res = await fetch(`${API_URL}/api/safehouses`);
  if (!res.ok) throw new Error(`Failed to fetch safehouses: ${res.status}`);
  return res.json();
}
