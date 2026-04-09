import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
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
import ProcessRecordingsPage from './pages/socialworker/ProcessRecordingsPage'
import VisitsConferencesPage from './pages/socialworker/VisitsConferencesPage'
import InterventionPlansPage from './pages/socialworker/InterventionPlansPage'
import CaseConferencesPage from './pages/socialworker/CaseConferencesPage'
import AssessmentsPage from './pages/socialworker/AssessmentsPage'
import DonorHomePage from './pages/donor/DonorHomePage'
import DonationHistoryPage from './pages/donor/DonationHistoryPage'
import DonorProfilePage from './pages/donor/DonorProfilePage'
import DonationReportPage from './pages/admin/donationReport/DonationReportPage'
import PrivacyPolicyPage from './pages/public/PrivacyPolicyPage'
import ImpactPage from './pages/public/ImpactPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import SafehouseLocationsPage from './pages/admin/SafehouseLocationsPage'
import ReportsPage from './pages/admin/ReportsPage'
import SocialMediaPage from './pages/admin/SocialMediaPage'
import SocialWorkersPage from './pages/admin/users/SocialWorkersPage'
import PartnersPage from './pages/admin/users/PartnersPage'
import ResidentsManagePage from './pages/admin/users/ResidentsManagePage'
import DonorsPage from './pages/admin/users/DonorsPage'
import ApprovalsPage from './pages/admin/ApprovalsPage'
import CookieConsent from './components/common/CookieConsent'

function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CookieConsent />
          <Routes>
            {/* Public pages */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/donate" element={<DonateNowPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/impact" element={<ImpactPage />} />
            </Route>

            {/* Social Worker pages */}
            <Route element={<ProtectedRoute allowedRoles={['SocialWorker', 'Admin']} />}>
              <Route path="/socialworker/dashboard" element={<SocialWorkerLayout />}>
                <Route index element={<SocialWorkerHomePage />} />
                <Route path="residents" element={<ResidentsPage />} />
                <Route path="residents/:id" element={<ResidentDetailPage />} />
                <Route path="process-recordings" element={<ProcessRecordingsPage />} />
                <Route path="home-visits" element={<VisitsConferencesPage />} />
                <Route path="intervention-plans" element={<InterventionPlansPage />} />
                <Route path="case-conferences" element={<CaseConferencesPage />} />
                <Route path="assessments" element={<AssessmentsPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
              </Route>
            </Route>

            {/* Donor pages */}
            <Route element={<ProtectedRoute allowedRoles={['Donor', 'Admin']} />}>
              <Route path="/donor" element={<DonorLayout />}>
                <Route index element={<DonorHomePage />} />
                <Route path="donate" element={<DonateNowPage />} />
                <Route path="history" element={<DonationHistoryPage />} />
                <Route path="profile" element={<DonorProfilePage />} />
              </Route>
            </Route>

            {/* Admin pages */}
            <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="donation-report" element={<DonationReportPage />} />
                <Route path="safehouse-locations" element={<SafehouseLocationsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="social-media" element={<SocialMediaPage />} />
                <Route path="sw" element={<SocialWorkerHomePage />} />
                <Route path="sw/residents" element={<ResidentsPage />} />
                <Route path="sw/residents/:id" element={<ResidentDetailPage />} />
                <Route path="sw/process-recordings" element={<ProcessRecordingsPage />} />
                <Route path="sw/home-visits" element={<VisitsConferencesPage />} />
                <Route path="sw/intervention-plans" element={<InterventionPlansPage />} />
                <Route path="sw/analytics" element={<AnalyticsPage />} />
                <Route path="users/social-workers" element={<SocialWorkersPage />} />
                <Route path="users/partners" element={<PartnersPage />} />
                <Route path="users/residents" element={<ResidentsManagePage />} />
                <Route path="residents/:id" element={<ResidentDetailPage />} />
                <Route path="users/donors" element={<DonorsPage />} />
                <Route path="approvals" element={<ApprovalsPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
    </GoogleOAuthProvider>
  )
}

export default App
