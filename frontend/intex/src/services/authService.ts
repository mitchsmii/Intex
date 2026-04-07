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

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Login failed')
    return data
  },

  async getMe(token: string): Promise<AuthUser> {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Session expired')
    return res.json()
  },
}
