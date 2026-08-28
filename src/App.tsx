import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { AppShell } from '@/components/layout/AppShell'
import { QaDashboardPage } from '@/pages/QaDashboardPage'
import { ApiAutomationPage } from '@/pages/ApiAutomationPage'
import { SuitesPage } from '@/pages/SuitesPage'
import { TestCasesPage } from '@/pages/TestCasesPage'
import { UploadPage } from '@/pages/UploadPage'
import { ReviewPage } from '@/pages/ReviewPage'
import { RunsPage } from '@/pages/RunsPage'
import { RunDetailPage } from '@/pages/RunDetailPage'
import { ExecutionPage } from '@/pages/ExecutionPage'
import { BugsPage } from '@/pages/BugsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LoginPage } from '@/pages/LoginPage'
import { useAuthStore } from '@/store/useAuthStore'
import '@/store/useThemeStore'

const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <>{children}</>
}

export default function App() {
  return (
    <TooltipProvider delayDuration={200}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<QaDashboardPage />} />
            <Route path="/suites" element={<SuitesPage />} />
            <Route path="/cases" element={<TestCasesPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/runs/:runId" element={<RunDetailPage />} />
            <Route path="/execute/:runId" element={<ExecutionPage />} />
            <Route path="/api-automation" element={<ApiAutomationPage />} />
            <Route path="/bugs" element={<BugsPage />} />
            <Route
              path="/reports"
              element={
                <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading reports…</div>}>
                  <ReportsPage />
                </Suspense>
              }
            />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </TooltipProvider>
  )
}
