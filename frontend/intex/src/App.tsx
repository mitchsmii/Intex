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
import PrivacyPolicyPage from './pages/public/PrivacyPolicyPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import SafehouseLocationsPage from './pages/admin/SafehouseLocationsPage'
import ReportsPage from './pages/admin/ReportsPage'
import SocialWorkersPage from './pages/admin/users/SocialWorkersPage'
import PartnersPage from './pages/admin/users/PartnersPage'
import ResidentsManagePage from './pages/admin/users/ResidentsManagePage'
import DonorsPage from './pages/admin/users/DonorsPage'
import CookieConsent from './components/common/CookieConsent'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CookieConsent />
        <Routes>
          {/* Public pages */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/donate" element={<DonateNowPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
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
              <Route index element={<AdminDashboardPage />} />
              <Route path="donation-report" element={<DonationReportPage />} />
              <Route path="safehouse-locations" element={<SafehouseLocationsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="users/social-workers" element={<SocialWorkersPage />} />
              <Route path="users/partners" element={<PartnersPage />} />
              <Route path="users/residents" element={<ResidentsManagePage />} />
              <Route path="users/donors" element={<DonorsPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
