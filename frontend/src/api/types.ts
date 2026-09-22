export type ReportState = 'scheduled' | 'pending_approval' | 'approved' | 'sent_to_hr' | 'hr_final'
export type LayerSource = 'soldier' | 'commander' | 'hr'

export interface Capabilities {
  soldier: boolean
  commander: boolean
  hr: boolean
}

export interface Me {
  id: number
  personal_number: string
  full_name: string
  rank: string | null
  role_title: string | null
  unit: { id: number; name: string }
  commander: { id: number; full_name: string } | null
  capabilities: Capabilities
  direct_report_count: number
  hr_unit: { id: number; name: string } | null
}

export interface DemoUser {
  personal_number: string
  full_name: string
  rank: string | null
  role_title: string | null
  unit_name: string
  capabilities: Capabilities
}

export interface AuthConfig {
  dev_login_enabled: boolean
  sso_configured: boolean
  environment: string
}

export interface Reason {
  id: number
  code: string
  label: string
  description?: string | null
  is_present: boolean
  requires_notes: boolean
  icon?: string | null
}

export interface Meta {
  today: string
  now: string
  timezone: string
  reasons: Reason[]
}

export interface PersonRef {
  id: number
  full_name: string
  personal_number: string
}

export interface Layer {
  reason: Reason
  notes: string | null
  at: string | null
  by: PersonRef | null
}

export interface Report {
  id: number
  soldier_id: number
  report_date: string
  state: ReportState
  soldier_layer: Layer | null
  commander_layer: Layer | null
  hr_layer: Layer | null
  effective: { source: LayerSource; reason: Reason | null; notes: string | null }
  created_by: PersonRef | null
  approved_by: PersonRef | null
  approved_at: string | null
  sent_to_hr_at: string | null
  updated_at: string
}

export interface Soldier {
  id: number
  personal_number: string
  full_name: string
  rank: string | null
  role_title: string | null
  unit_id: number
  unit_name: string | null
  commander_id: number | null
}

export interface RosterRow {
  soldier: Soldier
  report: Report | null
}

export interface Roster {
  report_date: string
  rows: RosterRow[]
  unit?: { id: number; name: string }
}

export type AnomalySignal = 'notes_mismatch' | 'layer_conflict' | 'absence_pattern'

export interface AnomalyRun {
  run_date: string
  window_from: string
  window_to: string
  trigger: 'nightly' | 'manual'
  finished_at: string
  checked: number
  flagged: number
  failed: number
  cost_usd: number
}

export interface Anomaly {
  soldier: Soldier
  score: number
  severity: number
  signals: AnomalySignal[]
  facts: string[]
}

export interface Anomalies {
  configured: boolean
  run: AnomalyRun | null
  items: Anomaly[]
}

export interface SoldierHistory {
  soldier: Soldier
  reports: Report[]
}

export interface AuditEvent {
  id: number
  action: string
  actor_role: 'soldier' | 'commander' | 'hr' | 'system'
  actor: { id: number; full_name: string } | null
  changes: Record<string, { from: unknown; to: unknown }>
  created_at: string
  report_date: string
}

export interface CheckinSummary {
  id: number
  commander: { id: number; full_name: string }
  message: string | null
  created_at: string
  closed_at: string | null
  is_open: boolean
  total: number
  responded: number
  pending: number
  parent_request_id: number | null
}

export interface CheckinResponseRow {
  recipient: { id: number; full_name: string; personal_number: string; rank: string | null; unit_name: string | null }
  location_text: string | null
  responded_at: string | null
  updated_at: string | null
}

export interface CheckinDetail extends CheckinSummary {
  responses: CheckinResponseRow[]
}

/** A request I received from above, seen as a commander: my subordinates' answers + my re-sends. */
export interface ReceivedCheckin {
  request: Omit<CheckinSummary, 'total' | 'responded' | 'pending'>
  my_response: { location_text: string | null; responded_at: string | null }
  total: number
  responded: number
  pending: number
  responses: CheckinResponseRow[]
  resends: CheckinSummary[]
}

export interface IncomingCheckin {
  request: Omit<CheckinSummary, 'total' | 'responded' | 'pending'>
  location_text: string | null
  responded_at: string | null
  updated_at: string | null
}

export interface AppNotification {
  id: number
  kind: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}
