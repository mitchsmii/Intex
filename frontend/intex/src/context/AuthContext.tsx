import { createContext, useState, useEffect, type ReactNode } from 'react'
import { authService, type AuthUser } from '../services/authService'

export type { AuthUser }

export interface AuthContextType {
  user: AuthUser | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'cove_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(
    () => !!localStorage.getItem(TOKEN_KEY)
  )

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) return

    authService
      .getMe(stored)
      .then((authUser) => {
        setToken(stored)
        setUser(authUser)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (username: string, password: string) => {
    const result = await authService.login(username, password)
    localStorage.setItem(TOKEN_KEY, result.token)
    setToken(result.token)
    setUser(result.user)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}
