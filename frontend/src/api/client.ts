import axios, { AxiosError } from 'axios'
import { translateError } from '../lib/i18n'
import type {
  Anomalies,
  AppNotification,
  AuditEvent,
  AuthConfig,
  CheckinDetail,
  CheckinSummary,
  DemoUser,
  IncomingCheckin,
  Me,
  ReceivedCheckin,
  Meta,
  Report,
  Roster,
  SoldierHistory,
} from './types'

const TOKEN_KEY = 'doch1.token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export const http = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '' })

http.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let onUnauthenticated: (() => void) | null = null
export const setUnauthenticatedHandler = (fn: () => void) => {
  onUnauthenticated = fn
}

http.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ error?: { code?: string } }>) => {
    if (error.response?.status === 401 && tokenStore.get()) {
      tokenStore.clear()
      onUnauthenticated?.()
    }
    return Promise.reject(error)
  },
)

/** Stable machine-readable error code from an API error. */
export function errorCode(e: unknown): string {
  if (axios.isAxiosError(e)) {
    if (!e.response) return 'NETWORK_ERROR'
    return (e.response.data as { error?: { code?: string } })?.error?.code ?? 'UNKNOWN'
  }
  return 'UNKNOWN'
}

/** Hebrew message for any API error. */
export const errorMessage = (e: unknown) => translateError(errorCode(e))

const d = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data)

export const api = {
  authConfig: () => d<AuthConfig>(http.get('/api/auth/config')),
  demoUsers: () => d<DemoUser[]>(http.get('/api/auth/demo-users')),
  devLogin: (personal_number: string) => d<{ token: string; me: Me }>(http.post('/api/auth/dev-login', { personal_number })),
  logout: () => d(http.post('/api/auth/logout')),
  me: () => d<Me>(http.get('/api/auth/me')),
  meta: () => d<Meta>(http.get('/api/meta')),

  myReports: (date_from?: string, date_to?: string) => d<Report[]>(http.get('/api/my/reports', { params: { date_from, date_to } })),
  submitMyReport: (body: { report_date: string; reason_id: number; notes?: string | null }) =>
    d<Report>(http.post('/api/my/reports', body)),

  commanderRoster: (report_date: string) => d<Roster>(http.get('/api/commander/roster', { params: { report_date } })),
  submitMyReportRange: (body: { date_from: string; date_to: string; reason_id: number; notes?: string | null }) =>
    d<{ submitted: string[]; skipped_locked: string[] }>(http.post('/api/my/reports/range', body)),
  submitMyReportDates: (body: { report_dates: string[]; reason_id: number; notes?: string | null }) =>
    d<{ submitted: string[]; skipped_locked: string[] }>(http.post('/api/my/reports/dates', body)),
  commanderHistory: (soldierId: number, date_from: string, date_to: string) =>
    d<SoldierHistory>(http.get(`/api/commander/soldiers/${soldierId}/history`, { params: { date_from, date_to } })),
  approve: (reportId: number, body: { reason_id?: number | null; notes?: string | null } = {}) =>
    d<Report>(http.post(`/api/commander/reports/${reportId}/approve`, body)),
  onBehalf: (body: { soldier_id: number; report_date: string; reason_id: number; notes?: string | null }) =>
    d<Report>(http.post('/api/commander/reports/on-behalf', body)),
  sendToHr: (report_ids: number[]) => d<{ sent: number }>(http.post('/api/commander/reports/send-to-hr', { report_ids })),

  hrRoster: (report_date: string, q?: string) => d<Roster>(http.get('/api/hr/roster', { params: { report_date, q: q || undefined } })),
  hrHistory: (soldierId: number, date_from?: string, date_to?: string) =>
    d<SoldierHistory>(http.get(`/api/hr/soldiers/${soldierId}/history`, { params: { date_from, date_to } })),
  hrSet: (body: { soldier_id: number; report_date: string; reason_id: number; notes?: string | null }) =>
    d<Report>(http.post('/api/hr/reports', body)),
  hrAudit: (reportId: number) => d<AuditEvent[]>(http.get(`/api/hr/reports/${reportId}/audit`)),
  hrAnomalies: () => d<Anomalies>(http.get('/api/hr/anomalies')),
  hrAnomalyScan: () => d<Anomalies>(http.post('/api/hr/anomalies/scan')),
  hrExport: (date_from: string, date_to: string) =>
    http.get('/api/hr/export.csv', { params: { date_from, date_to }, responseType: 'blob' }).then((r) => r.data as Blob),

  checkinsIncoming: () => d<IncomingCheckin[]>(http.get('/api/checkins/incoming')),
  checkinRespond: (id: number, location_text: string) => d(http.post(`/api/checkins/${id}/respond`, { location_text })),
  checkinsIssued: () => d<{ subordinate_count: number; requests: CheckinSummary[] }>(http.get('/api/checkins/issued')),
  checkinCreate: (message?: string, parentRequestId?: number) =>
    d<CheckinDetail>(http.post('/api/checkins', { message: message || null, parent_request_id: parentRequestId ?? null })),
  checkinsReceived: () => d<ReceivedCheckin[]>(http.get('/api/checkins/received')),
  checkinDetail: (id: number) => d<CheckinDetail>(http.get(`/api/checkins/${id}`)),
  checkinClose: (id: number) => d<CheckinDetail>(http.post(`/api/checkins/${id}/close`)),

  notifications: () => d<{ unread: number; items: AppNotification[] }>(http.get('/api/notifications')),
  unreadCount: () => d<{ unread: number }>(http.get('/api/notifications/unread-count')),
  markRead: (id: number) => d(http.post(`/api/notifications/${id}/read`)),
  markAllRead: () => d(http.post('/api/notifications/read-all')),
}
