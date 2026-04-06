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
          <Link to="/dashboard" className="navbar-signin">Sign In</Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
