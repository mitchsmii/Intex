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

  const name = supporter.displayName
    ?? `${supporter.firstName ?? ''} ${supporter.lastName ?? ''}`.trim()
    || supporter.email
    || 'Donor'

  return (
    <div className="dp-page">
      <div className="dp-card">
        <div className="dp-avatar-row">
          <div className="dp-avatar">{name.charAt(0).toUpperCase()}</div>
          <div>
            <h1 className="dp-title">{name}</h1>
            <p className="dp-email">{supporter.email ?? '—'}</p>
          </div>
        </div>

        {success && (
          <div className="dp-success" role="status">
            Profile updated successfully.
          </div>
        )}
        {error && (
          <div className="dp-error" role="alert">
            {error}
          </div>
        )}

        {!editing ? (
          <>
            <div className="dp-fields">
              <div className="dp-field">
                <span className="dp-field-label">First Name</span>
                <span className="dp-field-value">{supporter.firstName || '—'}</span>
              </div>
              <div className="dp-field">
                <span className="dp-field-label">Last Name</span>
                <span className="dp-field-value">{supporter.lastName || '—'}</span>
              </div>
              <div className="dp-field">
                <span className="dp-field-label">Display Name</span>
                <span className="dp-field-value">{supporter.displayName || '—'}</span>
              </div>
              <div className="dp-field">
                <span className="dp-field-label">Phone</span>
                <span className="dp-field-value">{supporter.phone || '—'}</span>
              </div>
              <div className="dp-field">
                <span className="dp-field-label">Donor Since</span>
                <span className="dp-field-value">
                  {supporter.firstDonationDate
                    ? new Date(supporter.firstDonationDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    : '—'}
                </span>
              </div>
            </div>
            <button className="dp-btn dp-btn-primary" onClick={() => setEditing(true)}>
              Edit Profile
            </button>
          </>
        ) : (
          <>
            <div className="dp-form">
              <div className="dp-form-row">
                <label className="dp-label" htmlFor="dp-firstName">First Name</label>
                <input
                  id="dp-firstName"
                  className="dp-input"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Enter first name"
                />
              </div>
              <div className="dp-form-row">
                <label className="dp-label" htmlFor="dp-displayName">Display Name</label>
                <input
                  id="dp-displayName"
                  className="dp-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="How you'd like to appear"
                />
              </div>
              <div className="dp-form-row">
                <label className="dp-label" htmlFor="dp-phone">Phone</label>
                <input
                  id="dp-phone"
                  className="dp-input"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+63 9XX XXX XXXX"
                />
              </div>
            </div>
            <div className="dp-actions">
              <button className="dp-btn dp-btn-ghost" onClick={handleCancel} disabled={saving}>
                Cancel
              </button>
              <button className="dp-btn dp-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
