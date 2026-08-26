import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { checkSession } from '@/lib/api'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Providers from '@/pages/Providers'
import Settings from '@/pages/Settings'
import Chat from '@/pages/Chat'
import Docs from '@/pages/Docs'
import Layout from '@/components/Layout'

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    checkSession()
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false))
  }, [])

  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />
  }

  return (
    <Routes>
      <Route element={<Layout onLogout={() => setAuthenticated(false)} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/providers" element={<Providers />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/docs" element={<Docs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
