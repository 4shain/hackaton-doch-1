import DownloadIcon from '@mui/icons-material/Download'
import EditIcon from '@mui/icons-material/Edit'
import HistoryIcon from '@mui/icons-material/History'
import ManageSearchIcon from '@mui/icons-material/ManageSearch'
import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, errorMessage } from '../api/client'
import type { Report, Roster, RosterRow } from '../api/types'
import { useSession } from '../auth'
import { AnomaliesCard } from '../components/AnomaliesCard'
import { useToast } from '../components/AppShell'
import { accentFor, Empty, ErrorState, Loading, MetricCard, SectionTitle, StateChip, StatusChip } from '../components/common'
import { AuditDialog, ReportFormDialog } from '../components/dialogs'
import { CalendarDialog } from '../components/MonthCalendar'
import { Distribution } from '../components/Distribution'
import { addDays, fmtDay, fmtDayLong, SOURCE_LABEL } from '../lib/i18n'

type Filter = 'all' | 'handed' | 'pending' | 'missing' | 'hr'
const FILTERS: { key: Filter; label: string; match: (r: RosterRow) => boolean }[] = [
  { key: 'all', label: 'הכל', match: () => true },
  { key: 'handed', label: 'הועברו ע״י מפקד', match: (r) => r.report?.state === 'sent_to_hr' },
  { key: 'pending', label: 'טרם הועברו', match: (r) => ['scheduled', 'pending_approval', 'approved'].includes(r.report?.state ?? '') },
  { key: 'missing', label: 'חסרי דיווח', match: (r) => !r.report },
  { key: 'hr', label: 'עודכנו ע״י שלישות', match: (r) => r.report?.state === 'hr_final' },
]

export default function HrPage() {
  const { meta } = useSession()
  const toast = useToast()
  const theme = useTheme()
  const desktop = useMediaQuery(theme.breakpoints.up('md'))
  const today = meta.today
  const [date, setDate] = useState(today)
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [roster, setRoster] = useState<Roster | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<{ soldierId: number; name: string; date: string; report: Report | null } | null>(null)
  const [historyFor, setHistoryFor] = useState<RosterRow | null>(null)
  const [auditFor, setAuditFor] = useState<number | null>(null)
  const [exportFrom, setExportFrom] = useState(addDays(today, -30))
  const [exportTo, setExportTo] = useState(today)
  const [exporting, setExporting] = useState(false)
  const [historyNonce, setHistoryNonce] = useState(0)

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(q), 300)
    return () => window.clearTimeout(t)
  }, [q])

  const load = useCallback(() => {
    setError(null)
    api.hrRoster(date, query).then(setRoster, (e) => setError(errorMessage(e)))
  }, [date, query])
  useEffect(load, [load])

  const rows = useMemo(() => roster?.rows ?? [], [roster])
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter(f.match).length])) as Record<Filter, number>, [rows])
  const visible = rows.filter(FILTERS.find((f) => f.key === filter)!.match)

  const doExport = async () => {
    if (exportTo < exportFrom) {
      toast({ severity: 'error', message: 'טווח התאריכים אינו תקין.' })
      return
    }
    setExporting(true)
    try {
      const blob = await api.hrExport(exportFrom, exportTo)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `doch1_${exportFrom}_${exportTo}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast({ severity: 'success', message: 'הקובץ יוצא בהצלחה' })
    } catch (e) {
      toast({ severity: 'error', message: errorMessage(e) })
    } finally {
      setExporting(false)
    }
  }

  const actions = (row: RosterRow) => (
    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
      <Tooltip title="עדכון שלישות">
        <IconButton
          aria-label={`עדכון שלישות עבור ${row.soldier.full_name}`}
          onClick={() => setEditing({ soldierId: row.soldier.id, name: row.soldier.full_name, date, report: row.report })}
        >
          <EditIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="היסטוריה">
        <IconButton aria-label={`היסטוריה של ${row.soldier.full_name}`} onClick={() => setHistoryFor(row)}>
          <HistoryIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="יומן שינויים">
        <span>
          <IconButton aria-label={`יומן שינויים של ${row.soldier.full_name}`} disabled={!row.report} onClick={() => setAuditFor(row.report!.id)}>
            <ManageSearchIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  )

  const layer = (r: Report | null, k: 'soldier_layer' | 'commander_layer' | 'hr_layer') => {
    const l = r?.[k]
    return l ? (
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {l.reason.label}
        </Typography>
        {l.notes && (
          <Typography variant="caption" color="text.secondary">
            {l.notes}
          </Typography>
        )}
      </Box>
    ) : (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    )
  }

  return (
    <Stack spacing={2}>
      <Card sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Typography variant="h3" component="h2">
              ניהול שלישות – {roster?.unit?.name ?? ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {fmtDayLong(date)} · עדכוני שלישות נשמרים בשדה נפרד ואינם מוחקים את דיווחי החייל והמפקד
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <TextField
              type="date"
              size="small"
              label="תאריך"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              sx={{ width: 170 }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              label="חיפוש חייל"
              placeholder="שם או מספר אישי"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              sx={{ width: { xs: '100%', md: 220 } }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
            />
          </Stack>
        </Stack>
      </Card>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !roster ? (
        <Loading />
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
            <MetricCard label="הועברו ע״י מפקדים" value={counts.handed} tone="primary" onClick={() => setFilter('handed')} selected={filter === 'handed'} />
            <MetricCard label="טרם הועברו" value={counts.pending} tone="warning" onClick={() => setFilter('pending')} selected={filter === 'pending'} />
            <MetricCard label="חסרי דיווח" value={counts.missing} tone="danger" onClick={() => setFilter('missing')} selected={filter === 'missing'} />
            <MetricCard label="עודכנו ע״י שלישות" value={counts.hr} tone="neutral" onClick={() => setFilter('hr')} selected={filter === 'hr'} />
          </Box>

          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }} role="toolbar" aria-label="סינון">
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
              <Empty title="אין חיילים להצגה" subtitle={query ? 'נסו חיפוש אחר' : undefined} />
            </Card>
          ) : desktop ? (
            <TableContainer component={Card}>
              <Table size="small" aria-label="דיווחי היחידה">
                <TableHead>
                  <TableRow>
                    <TableCell>חייל</TableCell>
                    <TableCell>סטטוס סופי</TableCell>
                    <TableCell>מצב</TableCell>
                    <TableCell>דיווח חייל</TableCell>
                    <TableCell>דיווח מפקד</TableCell>
                    <TableCell>שלישות</TableCell>
                    <TableCell align="left">
                      <span className="visually-hidden">פעולות</span>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.map((row) => (
                    <TableRow key={row.soldier.id} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600 }}>
                          {row.soldier.rank} {row.soldier.full_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          <bdi>{row.soldier.personal_number}</bdi> · {row.soldier.role_title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <StatusChip report={row.report} />
                        {row.report && (
                          <Typography variant="caption" color="text.secondary" component="div">
                            לפי {SOURCE_LABEL[row.report.effective.source]}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{row.report ? <StateChip state={row.report.state} /> : '—'}</TableCell>
                      <TableCell>{layer(row.report, 'soldier_layer')}</TableCell>
                      <TableCell>{layer(row.report, 'commander_layer')}</TableCell>
                      <TableCell>{layer(row.report, 'hr_layer')}</TableCell>
                      <TableCell>{actions(row)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Stack spacing={1.25}>
              {visible.map((row) => (
                <Card key={row.soldier.id} sx={{ p: 1.5, borderInlineStart: `4px solid ${accentFor(row.report)}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>
                        {row.soldier.rank} {row.soldier.full_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        <bdi>{row.soldier.personal_number}</bdi> · {row.soldier.role_title}
                      </Typography>
                    </Box>
                    {actions(row)}
                  </Stack>
                  <Stack direction="row" spacing={0.75} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                    <StatusChip report={row.report} />
                    {row.report && <StateChip state={row.report.state} />}
                  </Stack>
                  {row.report && (
                    <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>
                      חייל: {row.report.soldier_layer?.reason.label ?? '—'} · מפקד: {row.report.commander_layer?.reason.label ?? '—'} · שלישות:{' '}
                      {row.report.hr_layer?.reason.label ?? '—'}
                    </Typography>
                  )}
                </Card>
              ))}
            </Stack>
          )}

          <Distribution rows={rows} title="התפלגות ביחידה" />
        </>
      )}

      <AnomaliesCard onOpenHistory={(soldier) => setHistoryFor({ soldier, report: null })} />

      <SectionTitle>ייצוא היסטוריה ל-CSV</SectionTitle>
      <Card sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <TextField type="date" size="small" label="מתאריך" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" size="small" label="עד תאריך" value={exportTo} onChange={(e) => setExportTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={doExport} disabled={exporting} sx={{ flexShrink: 0 }}>
            {exporting ? 'מייצא…' : 'ייצוא CSV'}
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          הקובץ כולל את כל חיילי היחידה בטווח (כולל ימים ללא דיווח), בעברית ובקידוד המתאים ל-Excel.
        </Typography>
      </Card>

      <ReportFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`עדכון שלישות – ${editing?.name ?? ''}`}
        subtitle={
          <Stack spacing={1}>
            <TextField
              type="date"
              size="small"
              label="תאריך הדיווח"
              value={editing?.date ?? date}
              onChange={(e) => editing && e.target.value && setEditing({ ...editing, date: e.target.value, report: e.target.value === date ? editing.report : null })}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ maxWidth: 220 }}
            />
            <Alert severity="info">
              {editing?.report
                ? 'העדכון יישמר בשדה השלישות. דיווחי החייל והמפקד נשמרים, והדיווח יינעל לשינויים שאינם של השלישות.'
                : 'אין דיווח לתאריך זה בתצוגה – ייווצר דיווח בשם החייל, מיוחס לשלישות.'}
            </Alert>
          </Stack>
        }
        reasons={meta.reasons}
        initial={editing?.report ? { reasonId: editing.report.effective.reason?.id ?? null, notes: editing.report.hr_layer?.notes ?? '' } : undefined}
        submitLabel="שמירת עדכון שלישות"
        onSubmit={async (v) => {
          if (!editing) return
          await api.hrSet({ soldier_id: editing.soldierId, report_date: editing.date, ...v })
          toast({ severity: 'success', message: `העדכון נשמר (${fmtDay(editing.date)})` })
          setHistoryNonce((n) => n + 1)
          load()
        }}
      />

      <CalendarDialog
        open={!!historyFor}
        onClose={() => setHistoryFor(null)}
        title={`היסטוריה – ${historyFor?.soldier.full_name ?? ''}`}
        today={today}
        initialDate={date}
        reloadKey={historyNonce}
        load={(from, to) => api.hrHistory(historyFor!.soldier.id, from, to).then((h) => h.reports)}
        renderActions={(d, r) => (
          <Stack direction="row" spacing={0.5}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEditing({ soldierId: historyFor!.soldier.id, name: historyFor!.soldier.full_name, date: d, report: r })}
            >
              {r ? 'עדכון שלישות' : 'דיווח בשם החייל'}
            </Button>
            {r && (
              <Button size="small" startIcon={<ManageSearchIcon />} onClick={() => setAuditFor(r.id)}>
                יומן
              </Button>
            )}
          </Stack>
        )}
      />

      <AuditDialog open={auditFor != null} onClose={() => setAuditFor(null)} load={() => api.hrAudit(auditFor!)} reasons={meta.reasons} />
    </Stack>
  )
}
