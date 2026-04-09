import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import './LoginPage.css'

function getRoleHomePath(roles: string[]): string {
  if (roles.includes('Admin')) return '/admin'
  if (roles.includes('SocialWorker')) return '/socialworker/dashboard'
  if (roles.includes('Donor')) return '/donor'
  return '/'
}

export default function LoginPage() {
  const { user, login, logout, isLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loggedOut, setLoggedOut] = useState(false)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string
    password?: string
  }>({})

  // If user lands on /login while already logged in, log them out so they can switch accounts
  useEffect(() => {
    if (!isLoading && user && !loggedOut) {
      logout()
      setLoggedOut(true)
    }
  }, [user, isLoading, logout, loggedOut])

  // After a fresh login, redirect to the appropriate page
  useEffect(() => {
    if (!isLoading && user && loggedOut) {
      const redirect = searchParams.get('redirect')
      navigate(redirect ?? getRoleHomePath(user.roles), { replace: true })
    }
  }, [user, isLoading, navigate, searchParams, loggedOut])

  const validate = (): boolean => {
    const errors: { username?: string; password?: string } = {}
    if (!username.trim()) errors.username = 'Username is required'
    if (!password) errors.password = 'Password is required'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)
    if (!validate()) return

    setSubmitting(true)
    try {
      await login(username, password)
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Login failed. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="login-loading">
        <div className="login-spinner" />
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-panel__content">
          <div className="login-panel__logo">COVE</div>
          <p className="login-panel__tagline">
            Protecting lives. Restoring futures.
          </p>
        </div>
        <svg
          className="login-panel__wave"
          viewBox="0 0 400 80"
          preserveAspectRatio="none"
        >
          <path
            d="M0,50 C80,90 160,10 240,50 C320,90 360,30 400,50 L400,80 L0,80 Z"
            fill="rgba(255,255,255,0.08)"
          />
          <path
            d="M0,60 C120,30 200,80 300,55 C360,40 380,65 400,58 L400,80 L0,80 Z"
            fill="rgba(255,255,255,0.05)"
          />
        </svg>
      </div>

      <div className="login-form-container">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <h1 className="login-card__heading">Welcome Back</h1>
          <p className="login-card__subheading">
            Sign in to your Cove account
          </p>

          {serverError && (
            <div className="login-error-banner" role="alert">
              {serverError}
            </div>
          )}

          <div className="login-field">
            <label className="login-field__label" htmlFor="login-username">
              Username
            </label>
            <div className="login-field__input-wrapper">
              <input
                id="login-username"
                className={`login-field__input${fieldErrors.username ? ' login-field__input--error' : ''}`}
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-describedby={
                  fieldErrors.username ? 'login-username-error' : undefined
                }
              />
            </div>
            {fieldErrors.username && (
              <p id="login-username-error" className="login-field__error">
                {fieldErrors.username}
              </p>
            )}
          </div>

          <div className="login-field">
            <label className="login-field__label" htmlFor="login-password">
              Password
            </label>
            <div className="login-field__input-wrapper">
              <input
                id="login-password"
                className={`login-field__input login-field__input--has-toggle${fieldErrors.password ? ' login-field__input--error' : ''}`}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={
                  fieldErrors.password ? 'login-password-error' : undefined
                }
              />
              <button
                type="button"
                className="login-field__toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {showPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            {fieldErrors.password && (
              <p id="login-password-error" className="login-field__error">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="login-submit"
            disabled={submitting}
            aria-label={submitting ? 'Signing in…' : 'Sign In'}
          >
            {submitting && <span className="login-spinner" />}
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>

          <a href="#" className="login-card__forgot">
            Forgot password?
          </a>

          <p className="login-card__footer">
            Don&apos;t have an account? Contact your administrator.
          </p>
        </form>
      </div>
    </div>
  )
}
