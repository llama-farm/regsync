import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { AdminDashboard } from './components/admin/AdminDashboard'
import { DocumentUpload } from './components/admin/DocumentUpload'
import { ChangeReview } from './components/admin/ChangeReview'
import { VersionHistory } from './components/admin/VersionHistory'
import { PolicyAssistant } from './components/user/PolicyAssistant'
import { DocumentsList } from './components/shared/DocumentsList'
import { SignInScreen } from './components/auth/SignInScreen'
import { useAuth, type Role } from './contexts/AuthContext'

function AppContent() {
  const { isAdmin, isSignedIn, showSignIn, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Reset navigation when signing in
  const handleSignIn = (role: Role) => {
    login(role)
    // Navigate to appropriate dashboard
    navigate(role === 'admin' ? '/admin' : '/dashboard', { replace: true })
  }

  // Redirect to appropriate page on role change
  useEffect(() => {
    if (isSignedIn && !showSignIn) {
      // If on an admin-only route as non-admin, redirect
      if (!isAdmin && (location.pathname.startsWith('/admin') || location.pathname === '/upload')) {
        navigate('/dashboard', { replace: true })
      }
      // If on user-only route as admin and just signed in, stay there or go to admin
      if (isAdmin && location.pathname === '/dashboard') {
        navigate('/admin', { replace: true })
      }
    }
  }, [isAdmin, isSignedIn, showSignIn, location.pathname, navigate])

  // Show sign-in screen
  if (showSignIn || !isSignedIn) {
    return <SignInScreen onSignIn={handleSignIn} />
  }

  return (
    <AppShell>
      <Routes>
        {/* Default route redirects based on role */}
        <Route
          path="/"
          element={<Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />}
        />

        {/* Admin routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/upload" element={<DocumentUpload />} />
        <Route path="/review/:documentId/:versionId" element={<ChangeReview />} />
        <Route path="/history/:documentId" element={<VersionHistory />} />

        {/* User routes - combined dashboard/chat */}
        <Route path="/dashboard" element={<PolicyAssistant />} />
        <Route path="/chat" element={<PolicyAssistant />} />

        {/* Shared routes */}
        <Route path="/documents" element={<DocumentsList />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

function App() {
  return <AppContent />
}

export default App
