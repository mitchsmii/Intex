import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PublicLayout from './components/common/PublicLayout'
import ProtectedRoute from './components/common/ProtectedRoute'
import SocialWorkerLayout from './components/common/SocialWorkerLayout'
import DonorLayout from './components/common/DonorLayout'
import AdminLayout from './components/common/AdminLayout'
import HomePage from './pages/public/HomePage'
import LoginPage from './pages/public/LoginPage'
import DonateNowPage from './pages/donor/DonateNowPage'
import SocialWorkerHomePage from './pages/socialworker/SocialWorkerHomePage'
import ResidentsPage from './pages/socialworker/ResidentsPage'
import ResidentDetailPage from './pages/socialworker/ResidentDetailPage'
import AnalyticsPage from './pages/socialworker/AnalyticsPage'
import DonorHomePage from './pages/donor/DonorHomePage'
import DonationHistoryPage from './pages/donor/DonationHistoryPage'
import DonationReportPage from './pages/admin/donationReport/DonationReportPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public pages */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/donate" element={<DonateNowPage />} />
          </Route>

          {/* Social Worker pages */}
          <Route element={<ProtectedRoute allowedRoles={['SocialWorker', 'Admin']} />}>
            <Route path="/socialworker/dashboard" element={<SocialWorkerLayout />}>
              <Route index element={<SocialWorkerHomePage />} />
              <Route path="residents" element={<ResidentsPage />} />
              <Route path="residents/:id" element={<ResidentDetailPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
            </Route>
          </Route>

          {/* Donor pages */}
          <Route element={<ProtectedRoute allowedRoles={['Donor', 'Admin']} />}>
            <Route path="/donor" element={<DonorLayout />}>
              <Route index element={<DonorHomePage />} />
              <Route path="donate" element={<DonateNowPage />} />
              <Route path="history" element={<DonationHistoryPage />} />
            </Route>
          </Route>

          {/* Admin pages */}
          <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="donation-report" element={<DonationReportPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
