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

export interface LoginResult {
  type: 'success'
  token: string
  user: AuthUser
}

export interface TwoFactorResult {
  type: 'requires2FA'
  userId: string
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResult | TwoFactorResult> {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Login failed')
    if (data.requires2FA) return { type: 'requires2FA', userId: data.userId }
    return { type: 'success', token: data.token, user: data.user }
  },

  async getMe(token: string): Promise<AuthUser> {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Session expired')
    return res.json()
  },

  async googleLogin(idToken: string): Promise<LoginResponse> {
    const res = await fetch(`${API_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Google sign-in failed')
    return data
  },

  async verifyTwoFactor(userId: string, code: string): Promise<LoginResponse> {
    const res = await fetch(`${API_URL}/api/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Invalid code')
    return data
  },
}
