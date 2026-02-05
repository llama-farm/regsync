import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppShell } from './components/layout/AppShell'
import { AdminDashboard } from './components/admin/AdminDashboard'
import { DocumentUpload } from './components/admin/DocumentUpload'
import { VersionHistory } from './components/admin/VersionHistory'
import { PolicyAssistant } from './components/user/PolicyAssistant'
import { DocumentsList } from './components/shared/DocumentsList'
import { SignInScreen } from './components/auth/SignInScreen'
import { useAuth } from './contexts/AuthContext'

// Wrapper component that handles navigation after sign-in
function AuthenticatedApp() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const prevUserRef = useRef<string | null>(null)

  // Navigate to default page when user changes (sign-in)
  useEffect(() => {
    if (user && user.id !== prevUserRef.current) {
      // New user signed in - navigate to their default page
      const defaultPath = isAdmin ? '/admin' : '/assistant'
      navigate(defaultPath, { replace: true })
    }
    prevUserRef.current = user?.id || null
  }, [user, isAdmin, navigate])

  return (
    <AppShell>
      <Routes>
        {/* Default route redirects based on role */}
        <Route
          path="/"
          element={<Navigate to={isAdmin ? '/admin' : '/assistant'} replace />}
        />

        {/* Admin routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/upload" element={<DocumentUpload />} />
        <Route path="/history/:documentId" element={<VersionHistory />} />

        {/* User routes - PolicyAssistant combines dashboard + chat */}
        <Route path="/assistant" element={<PolicyAssistant />} />

        {/* Shared routes */}
        <Route path="/documents" element={<DocumentsList />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

function App() {
  const { user, login } = useAuth()

  // Show sign-in screen if not logged in
  if (!user) {
    return <SignInScreen onSignIn={login} />
  }

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
      <AuthenticatedApp />
    </>
  )
}

export default App
