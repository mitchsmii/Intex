import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './DonateNowPage.css'

// Goal is stored in USD; all display converts from USD
const GOAL_USD = 100_000
const TOTAL_RAISED_USD = 0 // placeholder — replace with real API data

// Preset tiers in USD — converted to selected currency for display
const PRESET_AMOUNTS_USD = [25, 55, 100, 250, 1000]

// Monthly impact tiers in USD — shown in left card, converted to selected currency
const IMPACT_TIERS: { usd: number; label: string }[] = [
  { usd: 15,    label: 'provides essential vitamins for a child in care.' },
  { usd: 50,    label: "covers a child's monthly food expenses." },
  { usd: 100,   label: 'funds medical, dental, and educational services.' },
  { usd: 300,   label: 'employs professional caregiving staff.' },
  { usd: 1_500, label: 'covers the mortgage that keeps children sheltered.' },
]

interface Currency {
  code: string
  label: string
  symbol: string
  rate: number      // 1 USD = rate units of this currency
  locale: string
  decimals: number
}

const CURRENCIES: Currency[] = [
  { code: 'USD', label: 'US Dollar',         symbol: '$',  rate: 1,     locale: 'en-US', decimals: 2 },
  { code: 'PHP', label: 'Philippine Peso',   symbol: '₱',  rate: 56.5,  locale: 'en-PH', decimals: 0 },
  { code: 'EUR', label: 'Euro',              symbol: '€',  rate: 0.92,  locale: 'de-DE', decimals: 2 },
  { code: 'GBP', label: 'British Pound',     symbol: '£',  rate: 0.79,  locale: 'en-GB', decimals: 2 },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$', rate: 1.55,  locale: 'en-AU', decimals: 2 },
  { code: 'CAD', label: 'Canadian Dollar',   symbol: 'C$', rate: 1.36,  locale: 'en-CA', decimals: 2 },
  { code: 'SGD', label: 'Singapore Dollar',  symbol: 'S$', rate: 1.34,  locale: 'en-SG', decimals: 2 },
  { code: 'JPY', label: 'Japanese Yen',      symbol: '¥',  rate: 149.5, locale: 'ja-JP', decimals: 0 },
]

function convert(usd: number, currency: Currency) {
  return usd * currency.rate
}

function fmt(amount: number, currency: Currency, forceDecimals?: number) {
  const decimals = forceDecimals ?? currency.decimals
  return amount.toLocaleString(currency.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

type Frequency = 'one-time' | 'monthly'

export default function DonateNowPage() {
  const percent = Math.min(100, Math.round((TOTAL_RAISED_USD / GOAL_USD) * 100))

  const [fillWidth, setFillWidth] = useState(0)
  const fillRef = useRef<HTMLDivElement>(null)

  const [currency, setCurrency] = useState<Currency>(CURRENCIES[0])
  const [frequency, setFrequency] = useState<Frequency>('one-time')

  // Form state
  const [firstName, setFirstName]   = useState('')
  const [lastName, setLastName]     = useState('')
  const [email, setEmail]           = useState('')
  const [phone, setPhone]           = useState('')
  const [anonymous, setAnonymous]   = useState(false)
  const [amountChoice, setAmountChoice] = useState<number | null>(null)
  const [otherAmount, setOtherAmount]   = useState('')
  const [submitted, setSubmitted]       = useState(false)

  // Animate progress bar on mount
  useEffect(() => {
    const t = setTimeout(() => setFillWidth(percent), 120)
    return () => clearTimeout(t)
  }, [percent])

  // Reset pill selection when currency changes
  function handleCurrencyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = CURRENCIES.find(c => c.code === e.target.value) ?? CURRENCIES[0]
    setCurrency(next)
    setAmountChoice(null)
    setOtherAmount('')
  }

  function handlePillClick(usdVal: number) {
    setAmountChoice(prev => (prev === usdVal ? null : usdVal))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: wire to backend — send amountChoice (USD), currency.code, frequency
    setSubmitted(true)
  }

  const raisedDisplay = fmt(convert(TOTAL_RAISED_USD, currency), currency, 0)
  const goalDisplay   = fmt(convert(GOAL_USD, currency), currency, 0)

  const submitLabel = frequency === 'monthly'
    ? `Give ${currency.symbol}${amountChoice ? fmt(convert(amountChoice, currency), currency) : '…'}/mo`
    : 'Continue to Payment'

  return (
    <main className="donate-page">
      <div className="donate-layout">

        {/* ===== LEFT: Story + progress ===== */}
        <section className="story-card">
          <div className="story-tagline">Safety · Healing · Empowerment</div>
          <h1>Every Penny Goes Directly to the Children</h1>
          <p className="story-lead">
            Lighthouse Sanctuary is a 501(c)(3) nonprofit dedicated to helping children who have
            experienced sexual abuse and trafficking. Every dollar you give is spent providing
            refuge, rehabilitation, and reintegration services — so survivors can heal and
            reclaim their futures.
          </p>

          <div className="progress-section">
            <div className="progress-top">
              <span>Raised:&nbsp;<strong>{currency.symbol}{raisedDisplay}</strong></span>
              <span>Goal:&nbsp;<strong>{currency.symbol}{goalDisplay}</strong></span>
            </div>
            <div className="progress-track">
              <div
                ref={fillRef}
                className="progress-fill"
                style={{ width: `${fillWidth}%` }}
              />
            </div>
            {currency.code !== 'USD' && (
              <div className="progress-note">
                Amounts shown in {currency.label} ({currency.code}) · Goal is $100,000 USD
              </div>
            )}
          </div>

          <h3>Your Monthly Gift in Action</h3>
          <ul className="impact-list">
            {IMPACT_TIERS.map(tier => (
              <li key={tier.usd}>
                <strong>
                  {currency.symbol}{fmt(convert(tier.usd, currency), currency, 0)}/mo
                </strong>
                {' '}— {tier.label}
              </li>
            ))}
          </ul>

          <p className="story-note">
            Lighthouse Sanctuary is a registered 501(c)(3) nonprofit · EIN: 81-3220618 ·
            Your donation is tax-deductible to the full extent of the law. Questions?
            Contact us at Info@LighthouseSanctuary.org or (801) 831-3323.
          </p>
        </section>

        {/* ===== RIGHT: Donation form ===== */}
        <section className="donation-card" aria-label="Donation form">
          <h2>Choose Your Gift</h2>
          <p className="donation-subtext">
            Complete the form below to make a tax-deductible donation to Cove.
          </p>

          {submitted && (
            <div className="success-banner">
              Thank you for your generosity! Your donation has been received.
            </div>
          )}

          <form className="donation-form" onSubmit={handleSubmit}>

            {/* Donor info */}
            <div className="field-group">
              <h3>Donor Information</h3>

              <div className="inline-fields">
                <div>
                  <label htmlFor="first_name">First Name</label>
                  <input
                    type="text"
                    id="first_name"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="last_name">Last Name</label>
                  <input
                    type="text"
                    id="last_name"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="inline-fields">
                <div>
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                  <div className="help-text">For your receipt and updates.</div>
                </div>
                <div>
                  <label htmlFor="phone">Phone</label>
                  <input
                    type="tel"
                    id="phone"
                    placeholder="555-555-5555"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="checkbox-row">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={anonymous}
                  onChange={e => setAnonymous(e.target.checked)}
                />
                <label htmlFor="anonymous">Make my donation anonymous.</label>
              </div>
            </div>

            {/* Frequency toggle */}
            <div className="field-group">
              <div className="freq-header">
                <h3>Donation Frequency</h3>
                <Link to="/donor/history" className="history-link">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  View your history
                </Link>
              </div>
              <div className="freq-toggle" role="group" aria-label="Donation frequency">
                <button
                  type="button"
                  className={`freq-btn${frequency === 'one-time' ? ' freq-active' : ''}`}
                  onClick={() => setFrequency('one-time')}
                >
                  One-Time
                </button>
                <button
                  type="button"
                  className={`freq-btn${frequency === 'monthly' ? ' freq-active' : ''}`}
                  onClick={() => setFrequency('monthly')}
                >
                  Monthly
                </button>
              </div>
              {frequency === 'monthly' && (
                <div className="freq-callout">
                  Monthly donors make a lasting impact — your recurring gift helps us plan
                  ahead and reach more children each month.
                </div>
              )}
            </div>

            {/* Amount + currency */}
            <div className="field-group">
              <div className="amount-header">
                <h3>Donation Amount{frequency === 'monthly' ? ' / Month' : ''}</h3>
                <div className="currency-picker">
                  <label htmlFor="currency" className="currency-picker-label">Currency</label>
                  <select
                    id="currency"
                    value={currency.code}
                    onChange={handleCurrencyChange}
                    className="currency-select"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.symbol} {c.code} — {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pill-group">
                {PRESET_AMOUNTS_USD.map(usdVal => {
                  const display = fmt(convert(usdVal, currency), currency)
                  return (
                    <button
                      key={usdVal}
                      type="button"
                      className={`pill${amountChoice === usdVal ? ' selected' : ''}`}
                      onClick={() => handlePillClick(usdVal)}
                    >
                      {currency.symbol}{display}
                      {frequency === 'monthly' && <span className="pill-mo">/mo</span>}
                    </button>
                  )
                })}
              </div>

              <div>
                <label htmlFor="other_amount">
                  Other Amount ({currency.code}){frequency === 'monthly' ? ' per month' : ''}
                </label>
                <div className="other-amount-row">
                  <span className="currency-symbol">{currency.symbol}</span>
                  <input
                    type="number"
                    id="other_amount"
                    min="1"
                    step={currency.decimals === 0 ? '1' : '0.01'}
                    placeholder="Enter another amount"
                    value={otherAmount}
                    onChange={e => setOtherAmount(e.target.value)}
                  />
                </div>
                <div className="help-text">
                  If you enter an amount here, it will override the buttons above.
                </div>
              </div>
            </div>

            {/* Submit */}
            <div>
              <button type="submit" className="submit-btn">
                {submitLabel}
              </button>
              {frequency === 'monthly' && (
                <div className="recurring-note">
                  You can cancel your monthly gift at any time.
                </div>
              )}
              <div className="secure-text">
                This is a demo form. In production this connects to a secure payment processor.
              </div>
            </div>

          </form>
        </section>

      </div>
    </main>
  )
}
