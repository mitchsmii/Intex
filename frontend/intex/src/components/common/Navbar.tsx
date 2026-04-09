import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import logoImg from '../../assets/intex_logo.webp'
import ThemeToggle from './ThemeToggle'
import './Navbar.css'

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-left">
          <Link to="/" className="navbar-logo">
            <img src={logoImg} alt="Cove" className="navbar-logo-img" width="2816" height="1536" />
          </Link>
          <Link to="/" className="navbar-home navbar-desktop-link">Home</Link>
          <Link to="/impact" className="navbar-impact navbar-desktop-link">Our Impact</Link>
          <Link to="/donate" className="navbar-donate-link navbar-desktop-link">Donate</Link>
        </div>

        <div className="navbar-links">
          <Link to="/login" className="navbar-signin navbar-desktop-link">Sign In</Link>

          <button
            className="navbar-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span className={`navbar-hamburger-icon ${menuOpen ? 'navbar-hamburger-icon--open' : ''}`}>
              <span /><span /><span />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="navbar-drawer-overlay" onClick={() => setMenuOpen(false)} />
      )}
      <div className={`navbar-drawer ${menuOpen ? 'navbar-drawer--open' : ''}`}>
        <nav className="navbar-drawer-links">
          <Link to="/" className="navbar-drawer-link">Home</Link>
          <Link to="/impact" className="navbar-drawer-link">Our Impact</Link>
          <Link to="/donate" className="navbar-drawer-link">Donate</Link>
          <Link to="/login" className="navbar-drawer-link navbar-drawer-signin">Sign In</Link>
        </nav>
        <div className="navbar-drawer-theme">
          <span className="navbar-drawer-theme-label">Dark mode</span>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}

export default Navbar
