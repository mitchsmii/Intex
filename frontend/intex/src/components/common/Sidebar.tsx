import { NavLink } from 'react-router-dom'
import './Sidebar.css'

const navItems = [
  { to: '/dashboard', label: 'Cases', icon: '\u{1F4CB}' },
  { to: '/dashboard/notes', label: 'Notes', icon: '\u{270F}\u{FE0F}' },
  { to: '/dashboard/resources', label: 'Resources', icon: '\u{1F4DA}' },
  { to: '/dashboard/messages', label: 'Messages', icon: '\u{1F4AC}' },
  { to: '/dashboard/reports', label: 'Reports', icon: '\u{1F4CA}' },
]

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">~</span>
        Cove
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' sidebar-link-active' : ''}`
            }
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user">
        Sarah M.
      </div>
    </aside>
  )
}

export default Sidebar
