import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import './SocialWorkerLayout.css'

const socialWorkerNav = [
  { to: '/socialworker/dashboard', label: 'Dashboard', icon: '\u{1F3E0}' },
  { to: '/socialworker/dashboard/residents', label: 'Residents', icon: '\u{1F465}' },
  { to: '/socialworker/dashboard/analytics', label: 'Analytics', icon: '\u{1F4CA}' },
  { to: '/socialworker/dashboard/messages', label: 'Messages', icon: '\u{1F4AC}' },
  { to: '/donor/donate', label: 'Donate Now', icon: '\u{1F49A}' },
  { to: '/admin/donation-report', label: 'Donation Report', icon: '\u{1F4B0}' },
]

function SocialWorkerLayout() {
  return (
    <div className="sw-layout">
      <Sidebar items={socialWorkerNav} />
      <main className="sw-content">
        <Outlet />
      </main>
    </div>
  )
}

export default SocialWorkerLayout
