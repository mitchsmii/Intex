import { createContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { authService } from '../services/authService'
import type { AuthUser } from '../services/authService'

export interface AuthContextType {
  user: AuthUser | null
  token: string | null
  // isLoading is ONLY true during the initial mount session-restore.
  // The login form manages its own submitting state independently.
  isLoading: boolean
  login: (username: string, password: string) => Promise<{ requires2FA: boolean; userId?: string }>
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>
  verifyTwoFactor: (userId: string, code: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('cove_token')
    if (!stored) {
      setIsLoading(false)
      return
    }
    authService
      .getMe(stored)
      .then((u) => {
        setToken(stored)
        setUser(u)
      })
      .catch(() => {
        localStorage.removeItem('cove_token')
      })
      .finally(() => setIsLoading(false))
  }, []) // runs once on mount only — no dependencies that could re-trigger

  const login = useCallback(async (username: string, password: string): Promise<{ requires2FA: boolean; userId?: string }> => {
    const result = await authService.login(username, password)
    if (result.type === 'requires2FA') {
      return { requires2FA: true, userId: result.userId }
    }
    localStorage.setItem('cove_token', result.token)
    setToken(result.token)
    setUser(result.user)
    return { requires2FA: false }
  }, [])

  const register = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    const { token: t, user: u } = await authService.register(email, password, firstName, lastName)
    localStorage.setItem('cove_token', t)
    setToken(t)
    setUser(u)
  }, [])

  const verifyTwoFactor = useCallback(async (userId: string, code: string) => {
    const { token: t, user: u } = await authService.verifyTwoFactor(userId, code)
    localStorage.setItem('cove_token', t)
    setToken(t)
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('cove_token')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, verifyTwoFactor, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
