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

const USER_CACHE_KEY = 'cove_user'

function saveUserCache(u: AuthUser) {
  try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u)) } catch { /* ignore */ }
}

function loadUserCache(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch { return null }
}

function clearUserCache() {
  localStorage.removeItem(USER_CACHE_KEY)
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Listen for 401s emitted by apiService — clears React auth state so
  // ProtectedRoute redirects via React Router (no hard page reload).
  useEffect(() => {
    const onExpired = () => {
      localStorage.removeItem('cove_token')
      clearUserCache()
      setToken(null)
      setUser(null)
    }
    window.addEventListener('cove:auth-expired', onExpired)
    return () => window.removeEventListener('cove:auth-expired', onExpired)
  }, [])

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
        saveUserCache(u)
      })
      .catch((err) => {
        if (err?.message === 'UNAUTHORIZED') {
          // Token is invalid or expired — clear everything
          localStorage.removeItem('cove_token')
          clearUserCache()
        } else {
          // Transient network / server error — keep the token and use cached profile
          // so the user stays logged in rather than being kicked out by a blip
          const cached = loadUserCache()
          setToken(stored)
          setUser(cached) // may be null if no cache, ProtectedRoute will show spinner until re-fetch
        }
      })
      .finally(() => setIsLoading(false))
  }, []) // runs once on mount only

  const login = useCallback(async (username: string, password: string): Promise<{ requires2FA: boolean; userId?: string }> => {
    const result = await authService.login(username, password)
    if (result.type === 'requires2FA') {
      return { requires2FA: true, userId: result.userId }
    }
    localStorage.setItem('cove_token', result.token)
    setToken(result.token)
    setUser(result.user)
    saveUserCache(result.user)
    return { requires2FA: false }
  }, [])

  const register = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    const { token: t, user: u } = await authService.register(email, password, firstName, lastName)
    localStorage.setItem('cove_token', t)
    setToken(t)
    setUser(u)
    saveUserCache(u)
  }, [])

  const verifyTwoFactor = useCallback(async (userId: string, code: string) => {
    const { token: t, user: u } = await authService.verifyTwoFactor(userId, code)
    localStorage.setItem('cove_token', t)
    setToken(t)
    setUser(u)
    saveUserCache(u)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('cove_token')
    clearUserCache()
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, verifyTwoFactor, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
