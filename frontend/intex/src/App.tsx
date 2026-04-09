import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import LoadingSpinner from './components/common/LoadingSpinner'

// Layouts — always needed, small, keep eager
import PublicLayout from './components/common/PublicLayout'
import ProtectedRoute from './components/common/ProtectedRoute'
import SocialWorkerLayout from './components/common/SocialWorkerLayout'
import DonorLayout from './components/common/DonorLayout'
import AdminLayout from './components/common/AdminLayout'
import CookieConsent from './components/common/CookieConsent'

// Public pages — HomePage is the LCP page, keep eager; others lazy
import HomePage from './pages/public/HomePage'
const LoginPage         = lazy(() => import('./pages/public/LoginPage'))
const ImpactPage        = lazy(() => import('./pages/public/ImpactPage'))
const DonateNowPage     = lazy(() => import('./pages/donor/DonateNowPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/public/PrivacyPolicyPage'))

// Social worker pages — all lazy
const SocialWorkerHomePage    = lazy(() => import('./pages/socialworker/SocialWorkerHomePage'))
const ResidentsPage           = lazy(() => import('./pages/socialworker/ResidentsPage'))
const ResidentDetailPage      = lazy(() => import('./pages/socialworker/ResidentDetailPage'))
const AnalyticsPage           = lazy(() => import('./pages/socialworker/AnalyticsPage'))
const ProcessRecordingsPage   = lazy(() => import('./pages/socialworker/ProcessRecordingsPage'))
const VisitsConferencesPage   = lazy(() => import('./pages/socialworker/VisitsConferencesPage'))
const InterventionPlansPage   = lazy(() => import('./pages/socialworker/InterventionPlansPage'))
const CaseConferencesPage     = lazy(() => import('./pages/socialworker/CaseConferencesPage'))
const AssessmentsPage         = lazy(() => import('./pages/socialworker/AssessmentsPage'))

// Donor pages — all lazy
const DonorHomePage        = lazy(() => import('./pages/donor/DonorHomePage'))
const DonationHistoryPage  = lazy(() => import('./pages/donor/DonationHistoryPage'))
const DonorProfilePage     = lazy(() => import('./pages/donor/DonorProfilePage'))

// Admin pages — all lazy (these are the heaviest chunks)
const AdminDashboardPage    = lazy(() => import('./pages/admin/AdminDashboardPage'))
const DonationReportPage    = lazy(() => import('./pages/admin/donationReport/DonationReportPage'))
const SafehouseLocationsPage = lazy(() => import('./pages/admin/SafehouseLocationsPage'))
const ReportsPage           = lazy(() => import('./pages/admin/ReportsPage'))
const SocialMediaPage       = lazy(() => import('./pages/admin/SocialMediaPage'))
const SocialWorkersPage     = lazy(() => import('./pages/admin/users/SocialWorkersPage'))
const PartnersPage          = lazy(() => import('./pages/admin/users/PartnersPage'))
const ResidentsManagePage   = lazy(() => import('./pages/admin/users/ResidentsManagePage'))
const DonorsPage            = lazy(() => import('./pages/admin/users/DonorsPage'))
const ApprovalsPage         = lazy(() => import('./pages/admin/ApprovalsPage'))

const Fallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
    <LoadingSpinner size="lg" />
  </div>
)

function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CookieConsent />
          <Suspense fallback={<Fallback />}>
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
                  <Route path="sw/case-conferences" element={<CaseConferencesPage />} />
                  <Route path="sw/intervention-plans" element={<InterventionPlansPage />} />
                  <Route path="sw/assessments" element={<AssessmentsPage />} />
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
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
    </GoogleOAuthProvider>
  )
}

export default App
