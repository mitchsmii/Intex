import { Link } from 'react-router-dom'
import '../../styles/variables.css'

export default function DonorHomePage() {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Welcome, Donor</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
        Thank you for supporting Lighthouse Sanctuary. Your generosity helps children heal and
        reclaim their futures.
      </p>
      <Link
        to="/donor/donate"
        style={{
          display: 'inline-block',
          background: 'var(--cove-deep)',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: 'var(--radius-md)',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '1rem',
        }}
      >
        💚 Make a Donation
      </Link>
    </div>
  )
}
