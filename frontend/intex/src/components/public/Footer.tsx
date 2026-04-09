import { Link } from 'react-router-dom'
import ThemeToggle from '../common/ThemeToggle'
import './Footer.css'

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-theme-row">
        <span className="footer-theme-label">
          {/* sun icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
          </svg>
        </span>
        <ThemeToggle />
        <span className="footer-theme-label">
          {/* moon icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ opacity: 0.7 }}>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </span>
      </div>
      <p>&copy; 2026 Cove. All rights reserved.</p>
      <Link to="/privacy" className="footer-link">Privacy Policy</Link>
    </footer>
  )
}

export default Footer
