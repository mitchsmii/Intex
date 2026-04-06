import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/public/HomePage'
import SocialWorkerLayout from './components/common/SocialWorkerLayout'
import SocialWorkerHomePage from './pages/socialworker/SocialWorkerHomePage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<SocialWorkerLayout />}>
          <Route index element={<SocialWorkerHomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
