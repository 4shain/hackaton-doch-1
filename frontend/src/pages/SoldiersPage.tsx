import CheckIcon from '@mui/icons-material/Check'
import EditNoteIcon from '@mui/icons-material/EditNote'
import HistoryIcon from '@mui/icons-material/History'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import { Alert, Box, Button, Card, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckinStatusCard } from '../components/CheckinStatusCard'
import { api, errorMessage } from '../api/client'
import type { Roster, RosterRow } from '../api/types'
import { useSession } from '../auth'
import { useToast } from '../components/AppShell'
import { accentFor, Empty, ErrorState, Loading, PersonAvatar, SectionTitle, StateChip, StatusChip } from '../components/common'
import { ReportFormDialog } from '../components/dialogs'
import { CalendarDialog } from '../components/MonthCalendar'
import { fmtDayLong } from '../lib/i18n'
import { tokens } from '../theme'

type Filter = 'all' | 'missing' | 'pending' | 'sent' | 'scheduled'

const FILTERS: { key: Filter; label: string; match: (r: RosterRow) => boolean }[] = [
  { key: 'all', label: 'הכל', match: () => true },
  { key: 'missing', label: 'חסרי דיווח', match: (r) => !r.report },
  { key: 'pending', label: 'ממתינים לאישור', match: (r) => r.report?.state === 'pending_approval' },
  { key: 'scheduled', label: 'מתוכננים', match: (r) => r.report?.state === 'scheduled' },
  { key: 'sent', label: 'בשלישות', match: (r) => ['approved', 'sent_to_hr', 'hr_final'].includes(r.report?.state ?? '') },
]

export default function SoldiersPage() {
  const { meta } = useSession()
  const toast = useToast()
  const today = meta.today
  const [params] = useSearchParams()
  const date = params.get('date') ?? today
  const [roster, setRoster] = useState<Roster | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [edit, setEdit] = useState<{ row: RosterRow; mode: 'correct' | 'behalf' } | null>(null)
  const [historyRow, setHistoryRow] = useState<RosterRow | null>(null)

  const load = useCallback(() => {
    setError(null)
    api.commanderRoster(date).then(setRoster, (e) => setError(errorMessage(e)))
  }, [date])
  useEffect(load, [load])

  const rows = useMemo(() => roster?.rows ?? [], [roster])
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter(f.match).length])) as Record<Filter, number>, [rows])
  const visible = rows.filter(FILTERS.find((f) => f.key === filter)!.match)
  const isToday = date === today

  const replaceRow = (soldierId: number, report: RosterRow['report']) =>
    setRoster((prev) => prev && { ...prev, rows: prev.rows.map((r) => (r.soldier.id === soldierId ? { ...r, report } : r)) })

  const approve = async (row: RosterRow) => {
    setBusyId(row.soldier.id)
    try {
      replaceRow(row.soldier.id, await api.approve(row.report!.id))
      toast({ severity: 'success', message: `הדיווח של ${row.soldier.full_name} אושר והועבר לשלישות` })
    } catch (e) {
      toast({ severity: 'error', message: errorMessage(e) })
    } finally {
      setBusyId(null)
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!roster) return <Loading />

  return (
    <Stack spacing={2}>
      <CheckinStatusCard />

      <SectionTitle>פירוט חיילים{isToday ? '' : ` – ${fmtDayLong(date)}`}</SectionTitle>
      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }} role="toolbar" aria-label="סינון לפי מצב">
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={`${f.label} (${counts[f.key]})`}
            onClick={() => setFilter(f.key)}
            color={filter === f.key ? 'primary' : 'default'}
            variant={filter === f.key ? 'filled' : 'outlined'}
            aria-pressed={filter === f.key}
            sx={{ flexShrink: 0, height: 34, bgcolor: filter === f.key ? undefined : '#fff' }}
          />
        ))}
      </Stack>

      {visible.length === 0 ? (
        <Card>
          <Empty title="אין חיילים בסינון זה" subtitle={filter === 'missing' ? 'כל החיילים דיווחו 🎉' : undefined} />
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5 }}>
          {visible.map((row) => {
            const r = row.report
            const locked = r?.state === 'hr_final'
            const canApprove = r && (r.state === 'pending_approval' || r.state === 'scheduled')
            return (
              <Card key={row.soldier.id} sx={{ p: 2, borderInlineStart: `4px solid ${accentFor(r)}` }}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <PersonAvatar name={row.soldier.full_name} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h4" component="h3">
                          {row.soldier.rank} {row.soldier.full_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ת״ז <bdi>{row.soldier.personal_number}</bdi>
                          {row.soldier.role_title && ` · ${row.soldier.role_title}`}
                        </Typography>
                      </Box>
                      <Tooltip title="היסטוריית דיווחים">
                        <IconButton aria-label={`היסטוריית דיווחים של ${row.soldier.full_name}`} onClick={() => setHistoryRow(row)}>
                          <HistoryIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <Stack direction="row" spacing={0.75} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                      <StatusChip report={r} />
                      {r && <StateChip state={r.state} />}
                      {r?.effective.source === 'commander' && <Chip size="small" label="עודכן ע״י מפקד" variant="outlined" />}
                    </Stack>
                    {r?.effective.notes && (
                      <Typography variant="body2" sx={{ mt: 1, p: 1, bgcolor: tokens.surfaceLow, borderRadius: 2 }}>
                        {r.effective.notes}
                      </Typography>
                    )}
                    {r?.commander_layer && r.soldier_layer && (
                      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
                        דיווח החייל: {r.soldier_layer.reason.label}
                        {r.soldier_layer.notes ? ` – ${r.soldier_layer.notes}` : ''}
                      </Typography>
                    )}
                    {!locked && (
                      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                        {canApprove && (
                          <Button variant="contained" size="small" startIcon={<CheckIcon />} disabled={busyId === row.soldier.id} onClick={() => approve(row)}>
                            אשר דיווח
                          </Button>
                        )}
                        {r && isToday && (
                          <Button variant="outlined" size="small" startIcon={<EditNoteIcon />} onClick={() => setEdit({ row, mode: 'correct' })}>
                            {r.state === 'pending_approval' ? 'תקן ואשר' : 'עדכן סטטוס'}
                          </Button>
                        )}
                        {!r && isToday && (
                          <Button variant="outlined" size="small" startIcon={<PersonAddIcon />} onClick={() => setEdit({ row, mode: 'behalf' })}>
                            דווח בשם החייל
                          </Button>
                        )}
                      </Stack>
                    )}
                  </Box>
                </Stack>
              </Card>
            )
          })}
        </Box>
      )}

      <ReportFormDialog
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.mode === 'behalf' ? `דיווח בשם ${edit.row.soldier.full_name}` : `עדכון ואישור – ${edit?.row.soldier.full_name ?? ''}`}
        subtitle={
          <Alert severity="info">
            {edit?.mode === 'behalf'
              ? 'הדיווח יירשם כדיווח מפקד בשמך, ולא כדיווח של החייל.'
              : 'הסטטוס יישמר בשדה המפקד. דיווח החייל המקורי נשמר ללא שינוי.'}
          </Alert>
        }
        reasons={meta.reasons}
        initial={
          edit?.row.report
            ? {
                reasonId: (edit.row.report.commander_layer ?? edit.row.report.soldier_layer)?.reason.id ?? null,
                notes: (edit.row.report.commander_layer ?? edit.row.report.soldier_layer)?.notes ?? '',
              }
            : undefined
        }
        submitLabel={edit?.mode === 'behalf' ? 'שמירת דיווח' : 'עדכון ואישור'}
        onSubmit={async (v) => {
          if (!edit) return
          const report =
            edit.mode === 'behalf'
              ? await api.onBehalf({ soldier_id: edit.row.soldier.id, report_date: date, ...v })
              : await api.approve(edit.row.report!.id, v)
          replaceRow(edit.row.soldier.id, report)
          toast({ severity: 'success', message: 'הדיווח עודכן, אושר והועבר לשלישות' })
        }}
      />

      <CalendarDialog
        open={!!historyRow}
        onClose={() => setHistoryRow(null)}
        title={`היסטוריית דיווחים – ${historyRow?.soldier.full_name ?? ''}`}
        today={today}
        initialDate={date}
        load={(from, to) => api.commanderHistory(historyRow!.soldier.id, from, to).then((h) => h.reports)}
      />
    </Stack>
  )
}
