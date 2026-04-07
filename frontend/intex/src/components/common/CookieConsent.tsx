import { useState, useEffect } from 'react'
import './CookieConsent.css'

const COOKIE_NAME = 'cove_cookie_consent'

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (getCookie(COOKIE_NAME) === null) {
      setVisible(true)
    }
  }, [])

  function handleChoice(accepted: boolean) {
    setCookie(COOKIE_NAME, String(accepted), 365)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="cookie-banner" role="banner" aria-label="Cookie consent">
      <p className="cookie-banner__text">
        We use cookies to improve your experience.
      </p>
      <div className="cookie-banner__actions">
        <button
          className="cookie-banner__btn cookie-banner__btn--accept"
          onClick={() => handleChoice(true)}
        >
          Accept
        </button>
        <button
          className="cookie-banner__btn cookie-banner__btn--decline"
          onClick={() => handleChoice(false)}
        >
          Decline
        </button>
      </div>
    </div>
  )
}
