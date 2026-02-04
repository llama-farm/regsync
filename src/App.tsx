import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AdminDashboard } from './components/admin/AdminDashboard'
import { DocumentUpload } from './components/admin/DocumentUpload'
import { ChangeReview } from './components/admin/ChangeReview'
import { VersionHistory } from './components/admin/VersionHistory'
import { PolicyAssistant } from './components/user/PolicyAssistant'
import { DocumentsList } from './components/shared/DocumentsList'
import { SignInScreen } from './components/auth/SignInScreen'
import { useAuth } from './contexts/AuthContext'

function App() {
  const { user, isAdmin, login } = useAuth()

  // Show sign-in screen if not logged in
  if (!user) {
    return <SignInScreen onSignIn={login} />
  }

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
        <Route path="/review/:documentId/:versionId" element={<ChangeReview />} />
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

export default App
