import { useState, useRef } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import './LoginPage.css'

function getRoleRedirect(roles: string[]): string {
  if (roles.includes('Admin')) return '/admin'
  if (roles.includes('SocialWorker')) return '/socialworker/dashboard'
  if (roles.includes('Donor')) return '/donor'
  return '/'
}

export default function LoginPage() {
  const { user, login, isLoading } = useAuth()
  const [searchParams] = useSearchParams()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Ref guard prevents double-submission even under rapid clicks
  const submittingRef = useRef(false)

  // While the session is being restored on first load, show a spinner
  if (isLoading) {
    return (
      <div className="login-loading">
        <div className="login-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    )
  }

  // Already logged in — redirect immediately.
  // Admins always go to the admin dashboard, even if a stale `?redirect=`
  // query param (e.g. left over from a prior social-worker session) points
  // elsewhere. Otherwise honor the redirect param if present.
  if (user) {
    if (user.roles.includes('Admin')) {
      return <Navigate to="/admin" replace />
    }
    const redirect = searchParams.get('redirect')
    return <Navigate to={redirect ?? getRoleRedirect(user.roles)} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Hard guard — blocks any double-fire
    if (submittingRef.current) return

    setErrorMsg(null)

    if (!username.trim()) {
      setErrorMsg('Username is required')
      return
    }
    if (!password) {
      setErrorMsg('Password is required')
      return
    }

    submittingRef.current = true
    setSubmitting(true)

    try {
      await login(username.trim(), password)
      // login() resolves after setUser() — the `if (user)` Navigate at the top
      // of this component will fire on the next render and route by role.
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      {/* Left decorative panel */}
      <div className="login-panel">
        <div className="login-panel__content">
          <div className="login-panel__logo">Cove</div>
          <p className="login-panel__tagline">
            Protecting lives.
            <br />
            Restoring futures.
          </p>
        </div>
        {/* Subtle wave shape at bottom */}
        <svg
          className="login-panel__wave"
          viewBox="0 0 1440 80"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z"
            fill="rgba(168,213,186,0.15)"
          />
        </svg>
      </div>

      {/* Right form area */}
      <div className="login-form-container">
        <div className="login-card">
          <h1 className="login-card__heading">Welcome Back</h1>
          <p className="login-card__subheading">Sign in to your Cove account</p>

          {errorMsg && (
            <div className="login-error-banner" role="alert">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Username */}
            <div className="login-field">
              <label className="login-field__label" htmlFor="username">
                Username
              </label>
              <div className="login-field__input-wrapper">
                <input
                  id="username"
                  className={`login-field__input${errorMsg && !username.trim() ? ' login-field__input--error' : ''}`}
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={submitting}
                  aria-describedby={errorMsg ? 'login-error' : undefined}
                />
              </div>
            </div>

            {/* Password */}
            <div className="login-field">
              <label className="login-field__label" htmlFor="password">
                Password
              </label>
              <div className="login-field__input-wrapper">
                <input
                  id="password"
                  className={`login-field__input login-field__input--has-toggle${errorMsg && !password ? ' login-field__input--error' : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  aria-describedby={errorMsg ? 'login-error' : undefined}
                />
                <button
                  type="button"
                  className="login-field__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="login-submit"
              disabled={submitting}
              aria-label={submitting ? 'Signing in…' : 'Sign in'}
            >
              {submitting && <span className="login-spinner" />}
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <a href="#" className="login-card__forgot">
            Forgot password?
          </a>
          <p className="login-card__footer">
            Don't have an account? Contact your administrator.
          </p>
        </div>
      </div>
    </div>
  )
}
