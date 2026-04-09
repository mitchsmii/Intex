const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://intexbackend-dragb9ahdsfvejfe.centralus-01.azurewebsites.net'

export interface AuthUser {
  id: string
  username: string
  email: string
  roles: string[]
}

interface LoginResponse {
  token: string
  user: AuthUser
}

// Safely parse JSON — returns null if body is empty or not JSON
async function safeJson(res: Response): Promise<Record<string, unknown> | null> {
  const text = await res.text()
  if (!text || !text.trim()) return null
  try { return JSON.parse(text) } catch { return null }
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await safeJson(res)
    if (!res.ok) throw new Error((data?.message as string) || 'Login failed')
    return data as unknown as LoginResponse
  },

  async register(payload: {
    email: string
    password: string
    firstName?: string
    lastName?: string
    phone?: string
  }): Promise<LoginResponse> {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await safeJson(res)
    if (!res.ok) throw new Error((data?.message as string) || 'Registration failed')
    return data as unknown as LoginResponse
  },

  async googleLogin(idToken: string): Promise<LoginResponse> {
    const res = await fetch(`${API_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    const data = await safeJson(res)
    if (!res.ok) {
      const msg = (data?.message as string) || `Google sign-in failed (${res.status})`
      throw new Error(msg)
    }
    return data as unknown as LoginResponse
  },

  async getMe(token: string): Promise<AuthUser> {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Session expired')
    return res.json()
  },
}
