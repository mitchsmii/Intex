import { useEffect, useState } from 'react'
import './CookieConsent.css'
import {
  COOKIE_CONSENT_NAME,
  THEME_COOKIE_NAME,
  deleteCookie,
  getCookie,
  setPersistentCookie,
} from '../../utils/cookies'

type ConsentChoice = 'accepted' | 'declined'

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (getCookie(COOKIE_CONSENT_NAME) === null) {
      setVisible(true)
    }
  }, [])

  function handleChoice(choice: ConsentChoice) {
    setPersistentCookie(COOKIE_CONSENT_NAME, choice)

    if (choice !== 'accepted') {
      deleteCookie(THEME_COOKIE_NAME)
    }

    window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: { value: choice } }))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie consent" aria-live="polite">
      <div className="cookie-banner__content">
        <p className="cookie-banner__title">Cookie Preferences</p>
        <p className="cookie-banner__text">
          Cove uses a required consent cookie to remember your choice. Optional preference cookies,
          such as your saved theme, are only enabled if you accept them.
        </p>
      </div>
      <div className="cookie-banner__actions">
        <button
          className="cookie-banner__btn cookie-banner__btn--accept"
          onClick={() => handleChoice('accepted')}
        >
          Accept All
        </button>
        <button
          className="cookie-banner__btn cookie-banner__btn--decline"
          onClick={() => handleChoice('declined')}
        >
          Necessary Only
        </button>
      </div>
    </div>
  )
}
