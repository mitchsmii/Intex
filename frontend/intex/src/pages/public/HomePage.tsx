import { Link } from 'react-router-dom'
import './HomePage.css'

function HomePage() {
  return (
    <div className="home">
      <nav className="home-nav">
        <div className="home-nav-inner">
          <Link to="/" className="home-logo">
            <span className="home-logo-icon">~</span>
            Cove
          </Link>
          <div className="home-nav-links">
            <a href="#mission">Mission</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
            <Link to="/dashboard" className="home-nav-signin">Sign In</Link>
          </div>
        </div>
      </nav>

      <section className="home-hero">
        <h1>Compassionate Care, Secure Tools</h1>
        <p>A platform built with trauma-informed design for those who support survivors.</p>
      </section>

      <section className="home-roles">
        <div className="home-role-card">
          <h3>For Social Workers</h3>
          <p>
            Manage cases, track progress, document notes, and connect clients
            with resources — all in one secure place.
          </p>
        </div>
        <div className="home-role-card">
          <h3>For Administrators</h3>
          <p>
            Oversee operations, manage user access, generate reports, and
            ensure your team has what they need.
          </p>
        </div>
      </section>

      <footer className="home-footer">
        <p>&copy; 2026 Cove. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default HomePage
