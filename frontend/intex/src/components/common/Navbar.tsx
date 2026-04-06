import { Link } from 'react-router-dom'
import './Navbar.css'

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <span className="navbar-logo-icon">~</span>
          Cove
        </Link>
        <div className="navbar-links">
          <a href="#mission">Mission</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
          <Link to="/donor/donate" className="navbar-donate">Donate</Link>
          <Link to="/admin/donation-report" className="navbar-report">Donation Report</Link>
          <Link to="/dashboard" className="navbar-signin">Sign In</Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
