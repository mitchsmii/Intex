import { NavLink } from 'react-router-dom'
import './Sidebar.css'

interface NavItem {
  to: string
  label: string
  icon: string
}

interface SidebarProps {
  items: NavItem[]
}

function Sidebar({ items }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">~</span>
        Cove
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
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
        ))}
      </nav>

      <div className="sidebar-user">
        Sarah M.
      </div>
    </aside>
  )
}

export default Sidebar
