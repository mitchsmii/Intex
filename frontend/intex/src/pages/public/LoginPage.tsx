import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../../hooks/useAuth'
import './LoginPage.css'

function getRoleHomePath(roles: string[]): string {
  if (roles.includes('Admin')) return '/admin'
  if (roles.includes('SocialWorker')) return '/socialworker/dashboard'
  if (roles.includes('Donor')) return '/donor'
  return '/'
}

type View = 'login' | 'register'

export default function LoginPage() {
  const { user, login, register, googleLogin, isLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialCheckDone = useRef(false)

  const [view, setView] = useState<View>('login')

  // ── Login fields ──
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // ── Register fields ──
  const [regFirstName, setRegFirstName] = useState('')
  const [regLastName, setRegLastName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)

  // ── Shared state ──
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // On initial load only: if already logged in, redirect to their dashboard
  useEffect(() => {
    if (!isLoading && !initialCheckDone.current) {
      initialCheckDone.current = true
      if (user) {
        const redirect = searchParams.get('redirect')
        navigate(redirect ?? getRoleHomePath(user.roles), { replace: true })
      }
    }
  }, [isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  function switchView(v: View) {
    setView(v)
    setServerError(null)
    setFieldErrors({})
  }

  // ── Login submit ──
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
      const loggedInUser = await login(username, password)
      const redirect = searchParams.get('redirect')
      navigate(redirect ?? getRoleHomePath(loggedInUser.roles), { replace: true })
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Register submit ──
  const validateRegister = (): boolean => {
    const errors: Record<string, string> = {}
    if (!regFirstName.trim()) errors.regFirstName = 'First name is required'
    if (!regLastName.trim()) errors.regLastName = 'Last name is required'
    if (!regEmail.trim()) errors.regEmail = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) errors.regEmail = 'Enter a valid email'
    if (!regPassword) errors.regPassword = 'Password is required'
    else if (regPassword.length < 14) errors.regPassword = 'Password must be at least 14 characters'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)
    if (!validateRegister()) return
    setSubmitting(true)
    try {
      const newUser = await register({
        email: regEmail.trim(),
        password: regPassword,
        firstName: regFirstName.trim(),
        lastName: regLastName.trim(),
        phone: regPhone.trim() || undefined,
      })
      navigate(getRoleHomePath(newUser.roles), { replace: true })
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Google OAuth ──
  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return
    setServerError(null)
    setSubmitting(true)
    try {
      const loggedInUser = await googleLogin(credentialResponse.credential)
      const redirect = searchParams.get('redirect')
      navigate(redirect ?? getRoleHomePath(loggedInUser.roles), { replace: true })
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.')
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
        {/* ── LOGIN VIEW ── */}
        {view === 'login' && (
          <form className="login-card" onSubmit={handleLoginSubmit} noValidate>
            <h1 className="login-card__heading">Welcome Back</h1>
            <p className="login-card__subheading">Sign in to your Cove account</p>

            {serverError && (
              <div className="login-error-banner" role="alert">{serverError}</div>
            )}

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
                />
              </div>
              {fieldErrors.username && (
                <p className="login-field__error">{fieldErrors.username}</p>
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
                />
                <button
                  type="button"
                  className="login-field__toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {fieldErrors.password && (
                <p className="login-field__error">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              className="login-submit"
              disabled={submitting}
            >
              {submitting && <span className="login-spinner" />}
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>

            <div className="login-divider"><span>or</span></div>

            <div className="login-google-wrapper">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setServerError('Google sign-in failed. Please try again.')}
                text="signin_with"
                shape="rectangular"
                theme="outline"
              />
            </div>

            <a href="#" className="login-card__forgot">Forgot password?</a>

            <p className="login-card__footer">
              Don&apos;t have an account?{' '}
              <button type="button" className="login-card__switch" onClick={() => switchView('register')}>
                Create new donor account
              </button>
            </p>
          </form>
        )}

        {/* ── REGISTER VIEW ── */}
        {view === 'register' && (
          <form className="login-card" onSubmit={handleRegisterSubmit} noValidate>
            <h1 className="login-card__heading">Create Donor Account</h1>
            <p className="login-card__subheading">Join Cove and start making a difference</p>

            {serverError && (
              <div className="login-error-banner" role="alert">{serverError}</div>
            )}

            <div className="login-field-row">
              <div className="login-field">
                <label className="login-field__label" htmlFor="reg-firstName">First Name</label>
                <input
                  id="reg-firstName"
                  className={`login-field__input${fieldErrors.regFirstName ? ' login-field__input--error' : ''}`}
                  type="text"
                  autoComplete="given-name"
                  autoFocus
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                />
                {fieldErrors.regFirstName && (
                  <p className="login-field__error">{fieldErrors.regFirstName}</p>
                )}
              </div>

              <div className="login-field">
                <label className="login-field__label" htmlFor="reg-lastName">Last Name</label>
                <input
                  id="reg-lastName"
                  className={`login-field__input${fieldErrors.regLastName ? ' login-field__input--error' : ''}`}
                  type="text"
                  autoComplete="family-name"
                  value={regLastName}
                  onChange={(e) => setRegLastName(e.target.value)}
                />
                {fieldErrors.regLastName && (
                  <p className="login-field__error">{fieldErrors.regLastName}</p>
                )}
              </div>
            </div>

            <div className="login-field">
              <label className="login-field__label" htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                className={`login-field__input${fieldErrors.regEmail ? ' login-field__input--error' : ''}`}
                type="email"
                autoComplete="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
              />
              {fieldErrors.regEmail && (
                <p className="login-field__error">{fieldErrors.regEmail}</p>
              )}
            </div>

            <div className="login-field">
              <label className="login-field__label" htmlFor="reg-phone">Phone <span className="login-field__optional">(optional)</span></label>
              <input
                id="reg-phone"
                className="login-field__input"
                type="tel"
                autoComplete="tel"
                placeholder="+63 9XX XXX XXXX"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
              />
            </div>

            <div className="login-field">
              <label className="login-field__label" htmlFor="reg-password">Password</label>
              <div className="login-field__input-wrapper">
                <input
                  id="reg-password"
                  className={`login-field__input login-field__input--has-toggle${fieldErrors.regPassword ? ' login-field__input--error' : ''}`}
                  type={showRegPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="login-field__toggle"
                  onClick={() => setShowRegPassword((s) => !s)}
                  aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showRegPassword} />
                </button>
              </div>
              {fieldErrors.regPassword ? (
                <p className="login-field__error">{fieldErrors.regPassword}</p>
              ) : (
                <p className="login-field__hint">Minimum 14 characters</p>
              )}
            </div>

            <button
              type="submit"
              className="login-submit"
              disabled={submitting}
            >
              {submitting && <span className="login-spinner" />}
              {submitting ? 'Creating account…' : 'Create Account'}
            </button>

            <div className="login-divider"><span>or</span></div>

            <div className="login-google-wrapper">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setServerError('Google sign-in failed. Please try again.')}
                text="signup_with"
                shape="rectangular"
                theme="outline"
              />
            </div>

            <p className="login-card__footer">
              Already have an account?{' '}
              <button type="button" className="login-card__switch" onClick={() => switchView('login')}>
                Sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Shared eye icon ──
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
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
