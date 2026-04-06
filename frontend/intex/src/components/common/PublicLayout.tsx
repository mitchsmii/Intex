import { Outlet } from 'react-router-dom'
<<<<<<< Updated upstream
import Navbar from './Navbar'
import Footer from '../public/Footer'
import './PublicLayout.css'

function PublicLayout() {
  return (
    <div className="public-layout">
      <Navbar />
      <main className="public-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default PublicLayout
=======

export default function PublicLayout() {
  return <Outlet />
}
>>>>>>> Stashed changes
