import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setUnauthenticatedHandler, tokenStore } from './api/client'
import type { Me, Meta } from './api/types'

interface AuthState {
  me: Me | null
  meta: Meta | null
  loading: boolean
  loginDemo: (personalNumber: string) => Promise<void>
  logout: () => Promise<void>
  refreshMeta: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshMeta = useCallback(async () => {
    setMeta(await api.meta())
  }, [])

  useEffect(() => {
    setUnauthenticatedHandler(() => setMe(null))
    const boot = async () => {
      try {
        if (tokenStore.get()) {
          const [m, mt] = await Promise.all([api.me(), api.meta()])
          setMe(m)
          setMeta(mt)
        }
      } catch {
        tokenStore.clear()
      } finally {
        setLoading(false)
      }
    }
    boot()
  }, [])

  const loginDemo = useCallback(async (pn: string) => {
    const { token, me: m } = await api.devLogin(pn)
    tokenStore.set(token)
    setMeta(await api.meta())
    setMe(m)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* session may already be gone */
    }
    tokenStore.clear()
    setMe(null)
  }, [])

  const value = useMemo(() => ({ me, meta, loading, loginDemo, logout, refreshMeta }), [me, meta, loading, loginDemo, logout, refreshMeta])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}

/** Authenticated-only accessor. */
export function useSession() {
  const { me, meta, ...rest } = useAuth()
  if (!me || !meta) throw new Error('useSession requires a logged-in user')
  return { me, meta, ...rest }
}
