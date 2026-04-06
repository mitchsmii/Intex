import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PublicLayout from './components/common/PublicLayout'
import SocialWorkerLayout from './components/common/SocialWorkerLayout'
import HomePage from './pages/public/HomePage'
import SocialWorkerHomePage from './pages/socialworker/SocialWorkerHomePage'
import ResidentsPage from './pages/socialworker/ResidentsPage'
import AnalyticsPage from './pages/socialworker/AnalyticsPage'
import ResidentDetailPage from './pages/socialworker/ResidentDetailPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
        </Route>

        {/* Social Worker pages */}
        <Route path="/dashboard" element={<SocialWorkerLayout />}>
          <Route index element={<SocialWorkerHomePage />} />
          <Route path="residents" element={<ResidentsPage />} />
          <Route path="residents/:id" element={<ResidentDetailPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
