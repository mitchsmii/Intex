import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/public/HomePage'
import SocialWorkerLayout from './components/common/SocialWorkerLayout'
import SocialWorkerHomePage from './pages/socialworker/SocialWorkerHomePage'
import DonateNowPage from './pages/donor/DonateNowPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<SocialWorkerLayout />}>
          <Route index element={<SocialWorkerHomePage />} />
        </Route>
        <Route path="/donate" element={<DonateNowPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
