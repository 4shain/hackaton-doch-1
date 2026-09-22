import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api } from './api/client'
import type { IncomingCheckin, Me } from './api/types'
import { useAuth } from './auth'
import { AppShell } from './components/AppShell'
import { Loading } from './components/common'
import CheckinRequiredPage from './pages/CheckinRequiredPage'
import CheckinsPage from './pages/CheckinsPage'
import HrPage from './pages/HrPage'
import LoginPage from './pages/LoginPage'
import MyReportPage from './pages/MyReportPage'
import HistoryPage from './pages/HistoryPage'
import SoldiersPage from './pages/SoldiersPage'

const POLL_MS = 15000

/** Open ירוק בעיניים requests the user has not answered yet. Polled so a new request takes over quickly. */
function usePendingCheckins(me: Me | null) {
  const [pending, setPending] = useState<IncomingCheckin[] | null>(null)

  const reload = useCallback(async () => {
    if (!me) return
    try {
      const items = await api.checkinsIncoming()
      setPending(items.filter((i) => i.request.is_open && !i.responded_at).sort((a, b) => a.request.created_at.localeCompare(b.request.created_at)))
    } catch {
      setPending((prev) => prev ?? [])
    }
  }, [me])

  useEffect(() => {
    if (!me) {
      setPending(null)
      return
    }
    reload()
    const t = window.setInterval(reload, POLL_MS)
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [me, reload])

  return { pending, reload }
}

export default function App() {
  const { me, meta, loading } = useAuth()
  const { pending, reload } = usePendingCheckins(me)

  if (loading) return <Loading label="מתחבר…" />
  if (!me || !meta) return <LoginPage />
  if (pending === null) return <Loading />
  if (pending.length > 0) return <CheckinRequiredPage pending={pending} onAnswered={reload} />

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<MyReportPage />} />
        <Route path="/soldiers" element={me.capabilities.commander ? <SoldiersPage /> : <Navigate to="/" replace />} />
        <Route path="/checkins" element={me.capabilities.commander ? <CheckinsPage /> : <Navigate to="/" replace />} />
        <Route path="/checkin" element={<Navigate to="/" replace />} />
        <Route path="/hr" element={me.capabilities.hr ? <HrPage /> : <Navigate to="/" replace />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
