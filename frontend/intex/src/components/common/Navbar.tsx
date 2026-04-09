<<<<<<< HEAD
import { Link } from 'react-router-dom'
import logoImg from '../../assets/intex_logo.png'
=======
import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import logoImg from '../../assets/intex_logo.webp'
import ThemeToggle from './ThemeToggle'
>>>>>>> c8d0a00dd3e3f94c41d98d639fe53be3f440995f
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