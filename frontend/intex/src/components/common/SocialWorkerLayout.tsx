import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import './SocialWorkerLayout.css'

function SocialWorkerLayout() {
  return (
    <div className="sw-layout">
      <Sidebar />
      <main className="sw-content">
        <Outlet />
      </main>
    </div>
  )
}

export default SocialWorkerLayout
