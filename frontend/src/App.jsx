import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Leaderboard from './pages/Leaderboard'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<Login />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/dashboard"   element={<Dashboard />} />
        <Route path="/chat"        element={<Chat />} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
