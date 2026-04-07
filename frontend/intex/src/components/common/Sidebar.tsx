import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import logoImg from '../../assets/intex_logo.png'
import './Sidebar.css'

export interface NavItem {
  to?: string
  label: string
  icon: ReactNode
  children?: NavItem[]
}

interface SidebarProps {
  items: NavItem[]
}

function SidebarGroup({ item }: { item: NavItem }) {
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

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <NavLink to="/" className="sidebar-logo">
        <img src={logoImg} alt="Cove" className="sidebar-logo-img" />
      </NavLink>

      <nav className="sidebar-nav">
        {items.map((item, i) =>
          item.children ? (
            <SidebarGroup key={i} item={item} />
          ) : item.to ? (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' sidebar-link-active' : ''}`
              }
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ) : null
        )}
      </nav>

      <div className="sidebar-user">
        <span className="sidebar-user-name">{user?.username ?? 'User'}</span>
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
      </div>
    </aside>
  )
}

export default Sidebar
