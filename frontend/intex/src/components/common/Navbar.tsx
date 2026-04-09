import { Link } from 'react-router-dom'
import logoImg from '../../assets/intex_logo.png'
import ThemeToggle from './ThemeToggle'
import './Navbar.css'

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <img src={logoImg} alt="Cove" className="navbar-logo-img" />
        </Link>
        <div className="navbar-links">
          <ThemeToggle />
          <Link to="/donate" className="navbar-donate">Donate</Link>
          <Link to="/login" className="navbar-signin">Sign In</Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
