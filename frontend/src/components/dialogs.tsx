import CloseIcon from '@mui/icons-material/Close'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useEffect, useState, type ReactNode } from 'react'
import { errorMessage } from '../api/client'
import type { AuditEvent, Layer, Reason, Report } from '../api/types'
import { AUDIT_ACTION, fmtDateTime, fmtDay, ROLE_LABEL, SOURCE_LABEL } from '../lib/i18n'
import { tokens } from '../theme'
import { Empty, ErrorState, Loading, ReasonIcon, StateChip, StatusChip } from './common'
import { ReasonPicker, reasonError, type ReasonValue } from './ReasonPicker'

export function AppDialog({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  actions?: ReactNode
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth} fullScreen={fullScreen} aria-labelledby="dialog-title">
      <DialogTitle id="dialog-title" sx={{ paddingInlineEnd: '56px', fontWeight: 700 }}>
        {title}
        <IconButton aria-label="סגירה" onClick={onClose} sx={{ position: 'absolute', insetInlineEnd: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      {actions && <DialogActions sx={{ p: 2, gap: 1 }}>{actions}</DialogActions>}
    </Dialog>
  )
}

/** Choose a status + notes and submit. Used by commander (correct / on behalf) and HR. */
export function ReportFormDialog({
  open,
  onClose,
  title,
  subtitle,
  reasons,
  initial,
  submitLabel,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  reasons: Reason[]
  initial?: { reasonId: number | null; notes: string | null }
  submitLabel: string
  onSubmit: (v: { reason_id: number; notes: string | null }) => Promise<void>
}) {
  const [value, setValue] = useState<ReasonValue>({ reasonId: null, notes: '' })
  const [showErrors, setShowErrors] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValue({ reasonId: initial?.reasonId ?? null, notes: initial?.notes ?? '' })
      setShowErrors(false)
      setError(null)
    }
  }, [open, initial?.reasonId, initial?.notes])

  const submit = async () => {
    const problem = reasonError(reasons, value)
    if (problem) {
      setShowErrors(true)
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ reason_id: value.reasonId!, notes: value.notes.trim() || null })
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="md"
      actions={
        <>
          <Button onClick={onClose}>ביטול</Button>
          <Button variant="contained" onClick={submit} disabled={busy}>
            {busy ? 'שומר…' : submitLabel}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        {subtitle}
        {error && <Alert severity="error">{error}</Alert>}
        <ReasonPicker reasons={reasons} value={value} onChange={setValue} showErrors={showErrors} idPrefix="dlg" />
      </Stack>
    </AppDialog>
  )
}

function LayerRow({ label, layer }: { label: string; layer: Layer | null }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 1 }}>
      <Typography variant="body2" sx={{ width: 96, flexShrink: 0, color: 'text.secondary', fontWeight: 600 }}>
        {label}
      </Typography>
      {layer ? (
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <ReasonIcon icon={layer.reason.icon} sx={{ fontSize: 18, color: tokens.primary }} />
            <Typography sx={{ fontWeight: 600 }}>{layer.reason.label}</Typography>
          </Stack>
          {layer.notes && (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {layer.notes}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {layer.by ? `${layer.by.full_name} · ` : ''}
            {fmtDateTime(layer.at)}
          </Typography>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          —
        </Typography>
      )}
    </Stack>
  )
}

/** The three preserved reporting layers side by side. */
export function LayersView({ report }: { report: Report }) {
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        <StatusChip report={report} />
        <StateChip state={report.state} />
        <Typography variant="caption" color="text.secondary">
          סטטוס סופי לפי {SOURCE_LABEL[report.effective.source]}
        </Typography>
      </Stack>
      <Divider />
      <LayerRow label="חייל" layer={report.soldier_layer} />
      <Divider />
      <LayerRow label="מפקד" layer={report.commander_layer} />
      <Divider />
      <LayerRow label="שלישות" layer={report.hr_layer} />
    </Box>
  )
}

export function HistoryDialog({
  open,
  onClose,
  title,
  load,
  renderActions,
}: {
  open: boolean
  onClose: () => void
  title: string
  load: () => Promise<Report[]>
  renderActions?: (r: Report) => ReactNode
}) {
  const [reports, setReports] = useState<Report[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = () => {
    setError(null)
    setReports(null)
    load().then(setReports, (e) => setError(errorMessage(e)))
  }
  useEffect(() => {
    if (open) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <AppDialog open={open} onClose={onClose} title={title} maxWidth="md">
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !reports ? (
        <Loading />
      ) : reports.length === 0 ? (
        <Empty title="אין דיווחים בטווח" />
      ) : (
        <Stack spacing={1.5}>
          {reports.map((r) => (
            <Box key={r.id} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>{fmtDay(r.report_date)}</Typography>
                {renderActions?.(r)}
              </Stack>
              <LayersView report={r} />
            </Box>
          ))}
        </Stack>
      )}
    </AppDialog>
  )
}

export function AuditDialog({ open, onClose, load, reasons }: { open: boolean; onClose: () => void; load: () => Promise<AuditEvent[]>; reasons: Reason[] }) {
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setEvents(null)
    setError(null)
    load().then(setEvents, (e) => setError(errorMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const fmtVal = (k: string, v: unknown) => {
    if (v == null || v === '') return '—'
    if (k.endsWith('reason_id')) return reasons.find((r) => r.id === v)?.label ?? String(v)
    if (k === 'state') return ({ scheduled: 'מתוכנן', pending_approval: 'ממתין לאישור', approved: 'אושר', sent_to_hr: 'בשלישות', hr_final: 'סופי' } as Record<string, string>)[String(v)] ?? String(v)
    return String(v)
  }
  const FIELD: Record<string, string> = {
    state: 'מצב',
    soldier_reason_id: 'סטטוס חייל',
    soldier_notes: 'הערות חייל',
    commander_reason_id: 'סטטוס מפקד',
    commander_notes: 'הערות מפקד',
    hr_reason_id: 'סטטוס שלישות',
    hr_notes: 'הערות שלישות',
  }

  return (
    <AppDialog open={open} onClose={onClose} title="יומן שינויים" maxWidth="md">
      {error ? (
        <ErrorState message={error} />
      ) : !events ? (
        <Loading />
      ) : events.length === 0 ? (
        <Empty title="אין אירועים" />
      ) : (
        <Stack spacing={1.5} component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {events.map((e) => (
            <Box component="li" key={e.id} sx={{ borderInlineStart: `3px solid ${tokens.primary}`, paddingInlineStart: '12px', py: 0.5 }}>
              <Typography sx={{ fontWeight: 700 }}>{AUDIT_ACTION[e.action] ?? e.action}</Typography>
              <Typography variant="body2" color="text.secondary">
                {e.actor ? e.actor.full_name : 'מערכת'} ({ROLE_LABEL[e.actor_role]}) · {fmtDateTime(e.created_at)} · עבור {fmtDay(e.report_date)}
              </Typography>
              {Object.entries(e.changes).map(([k, c]) => (
                <Typography key={k} variant="body2">
                  {FIELD[k] ?? k}: {fmtVal(k, c.from)} ← {fmtVal(k, c.to)}
                </Typography>
              ))}
            </Box>
          ))}
        </Stack>
      )}
    </AppDialog>
  )
}
