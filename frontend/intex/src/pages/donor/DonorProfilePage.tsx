import { useState, useEffect } from 'react'
import { api } from '../../services/apiService'
import type { Supporter } from '../../services/apiService'
import { useAuth } from '../../hooks/useAuth'
import './DonorProfilePage.css'

export default function DonorProfilePage() {
  const { user } = useAuth()
  const [supporter, setSupporter] = useState<Supporter | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Editable fields
  const [firstName, setFirstName] = useState('')
  const [phone, setPhone] = useState('')
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    if (!user?.email) return
    api.lookupSupporterByEmail(user.email)
      .then(s => {
        setSupporter(s)
        setFirstName(s.firstName ?? '')
        setPhone(s.phone ?? '')
        setDisplayName(s.displayName ?? '')
      })
      .catch(() => setError('No profile found for your account.'))
      .finally(() => setLoading(false))
  }, [user?.email])

  async function handleSave() {
    if (!supporter) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const updated = await api.updateSupporter(supporter.supporterId, {
        firstName: firstName.trim() || undefined,
        phone: phone.trim() || undefined,
        displayName: displayName.trim() || undefined,
      })
      setSupporter(updated)
      setEditing(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (!supporter) return
    setFirstName(supporter.firstName ?? '')
    setPhone(supporter.phone ?? '')
    setDisplayName(supporter.displayName ?? '')
    setEditing(false)
    setError(null)
  }

  if (loading) {
    return (
      <div className="dp-page">
        <p className="dp-loading">Loading your profile…</p>
      </div>
    )
  }

  if (!supporter) {
    return (
      <div className="dp-page">
        <div className="dp-card">
          <h1 className="dp-title">Your Profile</h1>
          <p className="dp-empty">{error ?? 'No donor profile linked to your account.'}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            If you have donated before, contact us to link your account.
          </p>
        </div>
      </div>
    )
  }

  const fullName = `${supporter.firstName ?? ''} ${supporter.lastName ?? ''}`.trim()
  const name = supporter.displayName || fullName || supporter.email || 'Donor'

  const donorSince = supporter.firstDonationDate
    ? new Date(supporter.firstDonationDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="dp-page">
      <div className="dp-card">
        {/* ── Avatar row ── */}
        <div className="dp-avatar-row">
          <div className="dp-avatar">{name.charAt(0).toUpperCase()}</div>
          <div>
            <h1 className="dp-title">{name}</h1>
            <p className="dp-email">{supporter.email ?? '—'}</p>
          </div>
        </div>

        {success && (
          <div className="dp-success" role="status">Profile updated successfully.</div>
        )}
        {error && (
          <div className="dp-error" role="alert">{error}</div>
        )}

        {/* ── Always-visible form ── */}
        <div className="dp-form">

          {/* First name — editable */}
          <div className="dp-form-row">
            <label className="dp-label" htmlFor="dp-firstName">First Name</label>
            <div className="dp-input-wrapper">
              <input
                id="dp-firstName"
                className={`dp-input${!editing ? ' dp-input--locked' : ''}`}
                value={firstName}
                disabled={!editing}
                onChange={e => setFirstName(e.target.value)}
                placeholder={editing ? 'Enter first name' : undefined}
              />
              {!editing && <span className="dp-lock-icon" aria-hidden="true">🔒</span>}
            </div>
          </div>

          {/* Last name — read-only always */}
          <div className="dp-form-row">
            <label className="dp-label" htmlFor="dp-lastName">Last Name</label>
            <div className="dp-input-wrapper">
              <input
                id="dp-lastName"
                className="dp-input dp-input--locked"
                value={supporter.lastName ?? ''}
                disabled
                readOnly
              />
              <span className="dp-lock-icon" aria-hidden="true">🔒</span>
            </div>
          </div>

          {/* Display name — editable */}
          <div className="dp-form-row">
            <label className="dp-label" htmlFor="dp-displayName">Display Name</label>
            <div className="dp-input-wrapper">
              <input
                id="dp-displayName"
                className={`dp-input${!editing ? ' dp-input--locked' : ''}`}
                value={displayName}
                disabled={!editing}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={editing ? 'How you\'d like to appear' : undefined}
              />
              {!editing && <span className="dp-lock-icon" aria-hidden="true">🔒</span>}
            </div>
          </div>

          {/* Email — read-only always */}
          <div className="dp-form-row">
            <label className="dp-label" htmlFor="dp-email">Email</label>
            <div className="dp-input-wrapper">
              <input
                id="dp-email"
                className="dp-input dp-input--locked"
                value={supporter.email ?? ''}
                disabled
                readOnly
              />
              <span className="dp-lock-icon" aria-hidden="true">🔒</span>
            </div>
          </div>

          {/* Phone — editable */}
          <div className="dp-form-row">
            <label className="dp-label" htmlFor="dp-phone">Phone</label>
            <div className="dp-input-wrapper">
              <input
                id="dp-phone"
                className={`dp-input${!editing ? ' dp-input--locked' : ''}`}
                value={phone}
                disabled={!editing}
                onChange={e => setPhone(e.target.value)}
                placeholder={editing ? '+63 9XX XXX XXXX' : undefined}
              />
              {!editing && <span className="dp-lock-icon" aria-hidden="true">🔒</span>}
            </div>
          </div>

          {/* Donor since — read-only always */}
          <div className="dp-form-row">
            <label className="dp-label" htmlFor="dp-donorSince">Donor Since</label>
            <div className="dp-input-wrapper">
              <input
                id="dp-donorSince"
                className="dp-input dp-input--locked"
                value={donorSince}
                disabled
                readOnly
              />
              <span className="dp-lock-icon" aria-hidden="true">🔒</span>
            </div>
          </div>
        </div>

        {/* ── Action buttons ── */}
        {!editing ? (
          <button className="dp-btn dp-btn-primary" onClick={() => setEditing(true)}>
            Edit Profile
          </button>
        ) : (
          <div className="dp-actions">
            <button className="dp-btn dp-btn-ghost" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
            <button className="dp-btn dp-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
