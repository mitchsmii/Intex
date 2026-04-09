export function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const candidate = (value ?? fallback).trim()
  return candidate.endsWith('/') ? candidate.slice(0, -1) : candidate
}
