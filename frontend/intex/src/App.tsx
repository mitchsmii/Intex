import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PublicLayout from './components/common/PublicLayout'
import SocialWorkerLayout from './components/common/SocialWorkerLayout'
import DonorLayout from './components/common/DonorLayout'
import AdminLayout from './components/common/AdminLayout'
import HomePage from './pages/public/HomePage'
import SocialWorkerHomePage from './pages/socialworker/SocialWorkerHomePage'
import ResidentsPage from './pages/socialworker/ResidentsPage'
import AnalyticsPage from './pages/socialworker/AnalyticsPage'
import ResidentDetailPage from './pages/socialworker/ResidentDetailPage'
import DonateNowPage from './pages/donor/DonateNowPage'
import DonorHomePage from './pages/donor/DonorHomePage'
import DonationHistoryPage from './pages/donor/DonationHistoryPage'
import DonationReportPage from './pages/admin/donationReport/DonationReportPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
        </Route>

        {/* Social Worker pages */}
        <Route path="/socialworker/dashboard" element={<SocialWorkerLayout />}>
          <Route index element={<SocialWorkerHomePage />} />
          <Route path="residents" element={<ResidentsPage />} />
          <Route path="residents/:id" element={<ResidentDetailPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
        </Route>

        {/* Donor pages */}
        <Route path="/donor" element={<DonorLayout />}>
          <Route index element={<DonorHomePage />} />
          <Route path="donate" element={<DonateNowPage />} />
          <Route path="history" element={<DonationHistoryPage />} />
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
