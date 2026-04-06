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

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://intexbackend-dragb9ahdsfvejfe.centralus-01.azurewebsites.net'

class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new AuthError(
        (body as { message?: string } | null)?.message ??
          `Login failed (${res.status})`
      )
    }

    return res.json() as Promise<LoginResponse>
  },

  async getMe(token: string): Promise<AuthUser> {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      throw new AuthError('Session expired')
    }

    return res.json() as Promise<AuthUser>
  },
}
