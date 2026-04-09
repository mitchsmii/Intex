import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import logoImg from '../../assets/intex_logo.webp'
import './Sidebar.css'

export interface NavItem {
  to?: string
  label: string
  icon: ReactNode
  badge?: number
  children?: NavItem[]
}

interface SidebarProps {
  items: NavItem[]
}

function SidebarGroup({ item, onClose }: { item: NavItem; onClose?: () => void }) {
  const location = useLocation()
  const isChildActive = item.children?.some(c => c.to && location.pathname.startsWith(c.to)) ?? false
  const [open, setOpen] = useState(isChildActive)

  return (
    <div className="sidebar-group">
      <button
        className={`sidebar-link sidebar-group-btn${isChildActive ? ' sidebar-link-active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="sidebar-link-icon">{item.icon}</span>
        <span className="sidebar-group-label">{item.label}</span>
        <svg
          className={`sidebar-chevron${open ? ' sidebar-chevron-open' : ''}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="sidebar-children">
          {item.children?.map(child => (
            child.to ? (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `sidebar-link sidebar-child-link${isActive ? ' sidebar-link-active' : ''}`
                }
              >
                <span className="sidebar-link-icon">{child.icon}</span>
                {child.label}
              </NavLink>
            ) : null
          ))}
        </div>
      )}
    </div>
  )
}

function Sidebar({ items }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const closeMenu = () => setMobileOpen(false)

  const logoutBtn = (
    <button
      className="sidebar-logout"
      onClick={handleLogout}
      aria-label="Log out"
      title="Log out"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  )

  const navItems = items.map((item, i) =>
    item.children ? (
      <SidebarGroup key={i} item={item} onClose={closeMenu} />
    ) : item.to ? (
      <NavLink
        key={item.to}
        to={item.to}
        end
        onClick={closeMenu}
        className={({ isActive }) =>
          `sidebar-link${isActive ? ' sidebar-link-active' : ''}`
        }
      >
        <span className="sidebar-link-icon">{item.icon}</span>
        {item.label}
        {item.badge != null && item.badge > 0 && (
          <span className="sidebar-badge">{item.badge}</span>
        )}
      </NavLink>
    ) : null
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <NavLink to="/" className="sidebar-logo">
          <img src={logoImg} alt="Cove" className="sidebar-logo-img" />
        </NavLink>
        <nav className="sidebar-nav">{navItems}</nav>
        <div className="sidebar-user">
          <span className="sidebar-user-name">{user?.username ?? 'User'}</span>
          {logoutBtn}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="mobile-topbar">
        <NavLink to="/" className="mobile-topbar-logo" onClick={closeMenu}>
          <img src={logoImg} alt="Cove" className="mobile-topbar-logo-img" />
        </NavLink>
        <button
          className="mobile-hamburger"
          onClick={() => setMobileOpen(o => !o)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          )}
        </button>
      </header>

      {/* Mobile dropdown drawer */}
      {mobileOpen && (
        <div className="mobile-nav-overlay" onClick={closeMenu}>
          <div className="mobile-nav-drawer" onClick={e => e.stopPropagation()}>
            <nav className="sidebar-nav mobile-nav-items">{navItems}</nav>
            <div className="sidebar-user mobile-nav-user">
              <span className="sidebar-user-name">{user?.username ?? 'User'}</span>
              {logoutBtn}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Sidebar
