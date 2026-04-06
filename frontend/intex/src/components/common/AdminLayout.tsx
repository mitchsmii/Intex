import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import './AdminLayout.css'

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: '\u{1F4CA}' },
  { to: '/admin/users', label: 'Manage Users', icon: '\u{1F465}' },
  { to: '/admin/roles', label: 'Roles', icon: '\u{1F511}' },
  { to: '/admin/reports', label: 'Reports', icon: '\u{1F4C8}' },
]

function AdminLayout() {
  return (
    <div className="admin-layout">
      <Sidebar items={adminNav} />
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout
