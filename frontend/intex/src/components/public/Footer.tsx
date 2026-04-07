import { Link } from 'react-router-dom'
import './Footer.css'

function Footer() {
  return (
    <footer className="footer">
      <p>&copy; 2026 Cove. All rights reserved.</p>
      <Link to="/privacy" className="footer-link">Privacy Policy</Link>
    </footer>
  )
}

export default Footer
