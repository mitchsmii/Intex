import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import './LoginPage.css'

function getRoleHomePath(roles: string[]): string {
  if (roles.includes('Admin')) return '/admin'
  if (roles.includes('SocialWorker')) return '/socialworker/dashboard'
  if (roles.includes('Donor')) return '/donor'
  return '/'
}

type Mode = 'login' | 'register' | '2fa'

export default function LoginPage() {
  const { user, login, logout, isLoading, register, verifyTwoFactor } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loggedOut, setLoggedOut] = useState(false)
  const initialAuthChecked = useRef(false)

  // Mode: login | register | 2fa
  const [mode, setMode] = useState<Mode>(
    searchParams.get('tab') === 'register' ? 'register' : 'login'
  )

  // Login fields
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Register fields
  const [regFirstName, setRegFirstName] = useState('')
  const [regLastName, setRegLastName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [registering, setRegistering] = useState(false)

  // 2FA state
  const [twoFactorUserId, setTwoFactorUserId] = useState<string | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  // Run once after auth state is known. If already logged in, log out so they can switch accounts.
  useEffect(() => {
    if (isLoading || initialAuthChecked.current) return
    initialAuthChecked.current = true
    if (user) {
      logout()
    }
    setLoggedOut(true)
  }, [isLoading, user, logout])

  // After a fresh login/register, redirect to the appropriate page
  useEffect(() => {
    if (!isLoading && user && loggedOut) {
      const redirect = searchParams.get('redirect')
      navigate(redirect ?? getRoleHomePath(user.roles), { replace: true })
    }
  }, [user, isLoading, navigate, searchParams, loggedOut])

  // ── Login ──────────────────────────────────────────────────────────────────

  const validateLogin = (): boolean => {
    const errors: Record<string, string> = {}
    if (!username.trim()) errors.username = 'Username is required'
    if (!password) errors.password = 'Password is required'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)
    if (!validateLogin()) return
    setSubmitting(true)
    try {
      const result = await login(username, password)
      if (result.requires2FA && result.userId) {
        setTwoFactorUserId(result.userId)
        setMode('2fa')
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Register ────────────────────────────────────────────────────────────────

  const validateRegister = (): boolean => {
    const errors: Record<string, string> = {}
    if (!regFirstName.trim()) errors.firstName = 'First name is required'
    if (!regLastName.trim()) errors.lastName = 'Last name is required'
    if (!regEmail.trim()) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) errors.email = 'Enter a valid email'
    if (!regPassword) errors.password = 'Password is required'
    else if (regPassword.length < 14) errors.password = 'Password must be at least 14 characters'
    if (regPassword !== regConfirm) errors.confirm = 'Passwords do not match'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)
    if (!validateRegister()) return
    setRegistering(true)
    try {
      await register(regEmail.trim(), regPassword, regFirstName.trim(), regLastName.trim())
      // redirect useEffect fires when user is set
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setRegistering(false)
    }
  }

  // ── 2FA ────────────────────────────────────────────────────────────────────

  const handleTwoFactorSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!twoFactorCode.trim() || !twoFactorUserId) return
    setServerError(null)
    setVerifying(true)
    try {
      await verifyTwoFactor(twoFactorUserId, twoFactorCode)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Invalid or expired code.')
    } finally {
      setVerifying(false)
    }
  }

  // ── Eye icon SVG ────────────────────────────────────────────────────────────

  function EyeIcon({ visible }: { visible: boolean }) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {visible ? (
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
    )
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
        <svg className="login-panel__wave" viewBox="0 0 400 80" preserveAspectRatio="none">
          <path d="M0,50 C80,90 160,10 240,50 C320,90 360,30 400,50 L400,80 L0,80 Z"
            fill="rgba(255,255,255,0.08)" />
          <path d="M0,60 C120,30 200,80 300,55 C360,40 380,65 400,58 L400,80 L0,80 Z"
            fill="rgba(255,255,255,0.05)" />
        </svg>
      </div>

      <div className="login-form-container">

        {/* ── 2FA form ── */}
        {mode === '2fa' && (
          <form className="login-card" onSubmit={handleTwoFactorSubmit} noValidate>
            <h1 className="login-card__heading">Two-Factor Verification</h1>
            <p className="login-card__subheading">Check your email for a 6-digit code</p>

            {serverError && (
              <div className="login-error-banner" role="alert">{serverError}</div>
            )}

            <div className="login-field">
              <label className="login-field__label" htmlFor="login-2fa-code">
                Verification Code
              </label>
              <div className="login-field__input-wrapper">
                <input
                  id="login-2fa-code"
                  className="login-field__input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <button
              type="submit"
              className="login-submit"
              disabled={verifying || twoFactorCode.length !== 6}
              aria-label={verifying ? 'Verifying…' : 'Verify Code'}
            >
              {verifying && <span className="login-spinner" />}
              {verifying ? 'Verifying…' : 'Verify Code'}
            </button>

            <button
              type="button"
              className="login-card__forgot"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => { setMode('login'); setTwoFactorUserId(null); setTwoFactorCode(''); setServerError(null) }}
            >
              Back to login
            </button>
          </form>
        )}

        {/* ── Login / Register forms ── */}
        {mode !== '2fa' && (
          <div className="login-card">
            {/* Tab switcher */}
            <div className="login-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={mode === 'login'}
                className={`login-tab${mode === 'login' ? ' login-tab--active' : ''}`}
                onClick={() => { setMode('login'); setServerError(null); setFieldErrors({}) }}
                type="button"
              >
                Sign In
              </button>
              <button
                role="tab"
                aria-selected={mode === 'register'}
                className={`login-tab${mode === 'register' ? ' login-tab--active' : ''}`}
                onClick={() => { setMode('register'); setServerError(null); setFieldErrors({}) }}
                type="button"
              >
                Create Account
              </button>
            </div>

            {serverError && (
              <div className="login-error-banner" role="alert">{serverError}</div>
            )}

            {/* ── Login form ── */}
            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} noValidate>
                <h1 className="login-card__heading">Welcome Back</h1>
                <p className="login-card__subheading">Sign in to your Cove account</p>

                <div className="login-field">
                  <label className="login-field__label" htmlFor="login-username">Username</label>
                  <div className="login-field__input-wrapper">
                    <input
                      id="login-username"
                      className={`login-field__input${fieldErrors.username ? ' login-field__input--error' : ''}`}
                      type="text"
                      autoComplete="username"
                      autoFocus
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      aria-describedby={fieldErrors.username ? 'login-username-error' : undefined}
                    />
                  </div>
                  {fieldErrors.username && (
                    <p id="login-username-error" className="login-field__error">{fieldErrors.username}</p>
                  )}
                </div>

                <div className="login-field">
                  <label className="login-field__label" htmlFor="login-password">Password</label>
                  <div className="login-field__input-wrapper">
                    <input
                      id="login-password"
                      className={`login-field__input login-field__input--has-toggle${fieldErrors.password ? ' login-field__input--error' : ''}`}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                    />
                    <button
                      type="button"
                      className="login-field__toggle"
                      onClick={() => setShowPassword(s => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <EyeIcon visible={showPassword} />
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p id="login-password-error" className="login-field__error">{fieldErrors.password}</p>
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

                <a href="#" className="login-card__forgot">Forgot password?</a>
              </form>
            )}

            {/* ── Register form ── */}
            {mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} noValidate>
                <h1 className="login-card__heading">Create Account</h1>
                <p className="login-card__subheading">Join Cove as a donor</p>

                <div className="login-inline-fields">
                  <div className="login-field">
                    <label className="login-field__label" htmlFor="reg-first">First Name</label>
                    <input
                      id="reg-first"
                      className={`login-field__input${fieldErrors.firstName ? ' login-field__input--error' : ''}`}
                      type="text"
                      autoComplete="given-name"
                      autoFocus
                      value={regFirstName}
                      onChange={e => setRegFirstName(e.target.value)}
                    />
                    {fieldErrors.firstName && (
                      <p className="login-field__error">{fieldErrors.firstName}</p>
                    )}
                  </div>
                  <div className="login-field">
                    <label className="login-field__label" htmlFor="reg-last">Last Name</label>
                    <input
                      id="reg-last"
                      className={`login-field__input${fieldErrors.lastName ? ' login-field__input--error' : ''}`}
                      type="text"
                      autoComplete="family-name"
                      value={regLastName}
                      onChange={e => setRegLastName(e.target.value)}
                    />
                    {fieldErrors.lastName && (
                      <p className="login-field__error">{fieldErrors.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="login-field">
                  <label className="login-field__label" htmlFor="reg-email">Email</label>
                  <input
                    id="reg-email"
                    className={`login-field__input${fieldErrors.email ? ' login-field__input--error' : ''}`}
                    type="email"
                    autoComplete="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                  />
                  {fieldErrors.email && (
                    <p className="login-field__error">{fieldErrors.email}</p>
                  )}
                </div>

                <div className="login-field">
                  <label className="login-field__label" htmlFor="reg-password">
                    Password <span className="login-field__hint">(min. 14 characters)</span>
                  </label>
                  <div className="login-field__input-wrapper">
                    <input
                      id="reg-password"
                      className={`login-field__input login-field__input--has-toggle${fieldErrors.password ? ' login-field__input--error' : ''}`}
                      type={showRegPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="login-field__toggle"
                      onClick={() => setShowRegPassword(s => !s)}
                      aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      <EyeIcon visible={showRegPassword} />
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="login-field__error">{fieldErrors.password}</p>
                  )}
                </div>

                <div className="login-field">
                  <label className="login-field__label" htmlFor="reg-confirm">Confirm Password</label>
                  <input
                    id="reg-confirm"
                    className={`login-field__input${fieldErrors.confirm ? ' login-field__input--error' : ''}`}
                    type="password"
                    autoComplete="new-password"
                    value={regConfirm}
                    onChange={e => setRegConfirm(e.target.value)}
                  />
                  {fieldErrors.confirm && (
                    <p className="login-field__error">{fieldErrors.confirm}</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="login-submit"
                  disabled={registering}
                  aria-label={registering ? 'Creating account…' : 'Create Account'}
                >
                  {registering && <span className="login-spinner" />}
                  {registering ? 'Creating account…' : 'Create Account'}
                </button>

                <p className="login-card__footer">
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="login-card__link-btn"
                    onClick={() => { setMode('login'); setServerError(null); setFieldErrors({}) }}
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
