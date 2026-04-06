import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PublicLayout from './components/common/PublicLayout'
import SocialWorkerLayout from './components/common/SocialWorkerLayout'
import HomePage from './pages/public/HomePage'
import SocialWorkerHomePage from './pages/socialworker/SocialWorkerHomePage'
import DonateNowPage from './pages/donor/DonateNowPage'

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
        </Route>
        <Route path="/donate" element={<DonateNowPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
