import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppShell } from './components/layout/AppShell'
import { AdminDashboard } from './components/admin/AdminDashboard'
import { DocumentUpload } from './components/admin/DocumentUpload'
import { VersionHistory } from './components/admin/VersionHistory'
import { PolicyAssistant } from './components/user/PolicyAssistant'
import { DocumentsList } from './components/shared/DocumentsList'
import { useAuth } from './contexts/AuthContext'

// Protected route wrapper for admin-only routes
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth()

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// Main app with routing
function AppRoutes() {
  const { isAuthenticated, isAdmin } = useAuth()
  const navigate = useNavigate()
  const wasAuthenticatedRef = useRef(isAuthenticated)

  // Navigate to admin dashboard when admin signs in
  useEffect(() => {
    if (isAuthenticated && !wasAuthenticatedRef.current) {
      // Just signed in as admin - go to admin dashboard
      navigate('/admin', { replace: true })
    } else if (!isAuthenticated && wasAuthenticatedRef.current) {
      // Just logged out - go to assistant
      navigate('/', { replace: true })
    }
    wasAuthenticatedRef.current = isAuthenticated
  }, [isAuthenticated, navigate])

  return (
    <AppShell>
      <Routes>
        {/* Default route - Policy Assistant for everyone */}
        <Route path="/" element={<PolicyAssistant />} />
        <Route path="/assistant" element={<PolicyAssistant />} />

        {/* Admin routes - protected */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/upload" element={<AdminRoute><DocumentUpload /></AdminRoute>} />
        <Route path="/history/:documentId" element={<AdminRoute><VersionHistory /></AdminRoute>} />

        {/* Shared routes */}
        <Route path="/documents" element={<DocumentsList />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

function App() {
  return (
    <>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          className: 'font-body',
        }}
      />
      <AppRoutes />
    </>
  )
}

export default App
