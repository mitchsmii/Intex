import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import './DonorLayout.css'

const donorNav = [
  { to: '/donor', label: 'Home', icon: '\u{1F3E0}' },
  { to: '/donor/donate', label: 'Donate Now', icon: '\u{1F49A}' },
  { to: '/donor/history', label: 'History', icon: '\u{1F4C4}' },
  { to: '/donor/profile', label: 'Profile', icon: '\u{1F464}' },
]

function DonorLayout() {
  return (
    <div className="donor-layout">
      <Sidebar items={donorNav} />
      <main className="donor-content">
        <Outlet />
      </main>
    </div>
  )
}

export default DonorLayout
