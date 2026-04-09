import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  COOKIE_CONSENT_NAME,
  THEME_COOKIE_NAME,
  deleteCookie,
  getCookie,
  setPersistentCookie,
} from '../utils/cookies'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

function hasAcceptedCookies() {
  return getCookie(COOKIE_CONSENT_NAME) === 'accepted'
}

function persistTheme(theme: Theme) {
  if (hasAcceptedCookies()) {
    setPersistentCookie(THEME_COOKIE_NAME, theme)
  } else {
    deleteCookie(THEME_COOKIE_NAME)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = getCookie(THEME_COOKIE_NAME)
    return storedTheme === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
  }, [theme])

  useEffect(() => {
    const handleConsentChange = () => {
      if (hasAcceptedCookies()) {
        setPersistentCookie(THEME_COOKIE_NAME, theme)
      } else {
        deleteCookie(THEME_COOKIE_NAME)
      }
    }

    window.addEventListener('cookie-consent-changed', handleConsentChange)
    return () => window.removeEventListener('cookie-consent-changed', handleConsentChange)
  }, [theme])

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme: Theme = currentTheme === 'light' ? 'dark' : 'light'
      persistTheme(nextTheme)
      return nextTheme
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
