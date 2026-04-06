import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PublicLayout from './components/common/PublicLayout'
import SocialWorkerLayout from './components/common/SocialWorkerLayout'
import DonorLayout from './components/common/DonorLayout'
import AdminLayout from './components/common/AdminLayout'
import HomePage from './pages/public/HomePage'
import LoginPage from './pages/public/LoginPage'
import DonateNowPage from './pages/donor/DonateNowPage'
import SocialWorkerHomePage from './pages/socialworker/SocialWorkerHomePage'
import ResidentsPage from './pages/socialworker/ResidentsPage'
import AnalyticsPage from './pages/socialworker/AnalyticsPage'
import ResidentDetailPage from './pages/socialworker/ResidentDetailPage'
import DonorHomePage from './pages/donor/DonorHomePage'
import DonationReportPage from './pages/admin/donationReport/DonationReportPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/donate" element={<DonateNowPage />} />
        </Route>

        {/* Social Worker pages */}
        <Route path="/dashboard" element={<SocialWorkerLayout />}>
          <Route index element={<SocialWorkerHomePage />} />
          <Route path="residents" element={<ResidentsPage />} />
          <Route path="residents/:id" element={<ResidentDetailPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
        </Route>

        {/* Donor pages */}
        <Route path="/donor" element={<DonorLayout />}>
          <Route index element={<DonorHomePage />} />
          <Route path="donate" element={<DonateNowPage />} />
        </Route>

        {/* Admin pages */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="donation-report" element={<DonationReportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
