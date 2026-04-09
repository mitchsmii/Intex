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
  login: (username: string, password: string) => Promise<AuthUser>
  register: (payload: {
    email: string
    password: string
    firstName?: string
    lastName?: string
    phone?: string
  }) => Promise<AuthUser>
  googleLogin: (idToken: string) => Promise<AuthUser>
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

  const login = useCallback(async (username: string, password: string) => {
    const { token: t, user: u } = await authService.login(username, password)
    localStorage.setItem('cove_token', t)
    setToken(t)
    setUser(u)
    return u // return user so LoginPage can navigate immediately
  }, [])

  const register = useCallback(async (payload: {
    email: string
    password: string
    firstName?: string
    lastName?: string
    phone?: string
  }) => {
    const { token: t, user: u } = await authService.register(payload)
    localStorage.setItem('cove_token', t)
    setToken(t)
    setUser(u)
    return u
  }, [])

  const googleLogin = useCallback(async (idToken: string) => {
    const { token: t, user: u } = await authService.googleLogin(idToken)
    localStorage.setItem('cove_token', t)
    setToken(t)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('cove_token')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
