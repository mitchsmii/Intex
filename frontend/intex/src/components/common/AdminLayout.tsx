import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import './AdminLayout.css'

const adminNav = [
  // Admin pages
  { to: '/admin', label: 'Admin Dashboard', icon: '\u{1F4CA}' },
  { to: '/admin/users', label: 'Manage Users', icon: '\u{1F465}' },
  { to: '/admin/roles', label: 'Roles', icon: '\u{1F511}' },
  { to: '/admin/reports', label: 'Reports', icon: '\u{1F4C8}' },
  { to: '/admin/donation-report', label: 'Donation Report', icon: '\u{1F4B0}' },
  // Social Worker pages
  { to: '/socialworker/dashboard', label: 'SW Dashboard', icon: '\u{1F3E0}' },
  { to: '/socialworker/dashboard/residents', label: 'Residents', icon: '\u{1F9D1}' },
  { to: '/socialworker/dashboard/analytics', label: 'Analytics', icon: '\u{1F4C9}' },
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
