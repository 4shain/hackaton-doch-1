import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import LockIcon from '@mui/icons-material/Lock'
import { Box, Button, ButtonBase, Card, IconButton, LinearProgress, Stack, Tooltip, Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { errorMessage } from '../api/client'
import type { Report } from '../api/types'
import { addMonths, fmtDayLong, fmtMonth, monthOf, monthRange, parseDay, STATE_LABEL } from '../lib/i18n'
import { tokens } from '../theme'
import { ErrorState, Pill, ReasonIcon } from './common'
import { AppDialog, LayersView } from './dialogs'

const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

type Kind = 'present' | 'absent' | 'missing' | 'empty'

function kindOf(report: Report | undefined, date: string, today: string): Kind {
  const reason = report?.effective.reason
  if (reason) return reason.is_present ? 'present' : 'absent'
  return date < today ? 'missing' : 'empty'
}

const KIND_STYLE: Record<Kind, { bg: string; border: string; fg: string }> = {
  present: { bg: tokens.successSoft, border: '#a7f3d0', fg: tokens.success },
  absent: { bg: tokens.warningSoft, border: '#fde68a', fg: tokens.warning },
  missing: { bg: tokens.dangerSoft, border: '#fecaca', fg: tokens.danger },
  empty: { bg: '#fff', border: '#e2e8f0', fg: tokens.onSurfaceVariant },
}

/**
 * Month calendar of attendance reports. Used for "my history" and for a soldier's history
 * (commander / HR), so both look the same. Data is loaded per visible month via `load`.
 */
export function MonthCalendar({
  today,
  load,
  renderActions,
  reloadKey = 0,
  initialDate,
  selectedDates,
  onDateSelect,
  fullBleedMobile = false,
}: {
  today: string
  load: (from: string, to: string) => Promise<Report[]>
  renderActions?: (date: string, report: Report | null) => ReactNode
  reloadKey?: number
  initialDate?: string
  selectedDates?: string[]
  onDateSelect?: (date: string) => void
  fullBleedMobile?: boolean
}) {
  const [month, setMonth] = useState(monthOf(initialDate ?? today))
  const [selected, setSelected] = useState<string>(initialDate ?? today)
  const [reports, setReports] = useState<Map<string, Report> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchMonth = useCallback(() => {
    const { first, last } = monthRange(month)
    setLoading(true)
    setError(null)
    load(first, last)
      .then((rs) => setReports(new Map(rs.map((r) => [r.report_date, r]))))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, reloadKey])
  useEffect(fetchMonth, [fetchMonth])

  const days = useMemo(() => {
    const count = parseDay(monthRange(month).last).getUTCDate()
    return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
  }, [month])
  const leading = parseDay(`${month}-01`).getUTCDay() // 0 = Sunday (first column, on the right in RTL)

  const summary = useMemo(() => {
    const s = { present: 0, absent: 0, missing: 0, scheduled: 0 }
    for (const d of days) {
      const r = reports?.get(d)
      const k = kindOf(r, d, today)
      if (k === 'present') s.present++
      else if (k === 'absent') s.absent++
      else if (k === 'missing') s.missing++
      if (r?.state === 'scheduled') s.scheduled++
    }
    return s
  }, [days, reports, today])

  const go = (n: number) => {
    const m = addMonths(month, n)
    setMonth(m)
    setSelected(m === monthOf(today) ? today : `${m}-01`)
  }
  const selectedReport = reports?.get(selected) ?? null

  return (
    <Stack spacing={1.5}>
      <Card
        sx={{
          p: { xs: 1.5, sm: 2 },
          ...(fullBleedMobile && { borderRadius: { xs: 0, sm: 2 }, borderInlineWidth: { xs: 0, sm: 1 } }),
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Tooltip title="החודש הקודם">
            <IconButton aria-label="החודש הקודם" onClick={() => go(-1)}>
              <ChevronRightIcon />
            </IconButton>
          </Tooltip>
          <Stack alignItems="center">
            <Typography variant="h3" component="h2" aria-live="polite">
              {fmtMonth(month)}
            </Typography>
            {month !== monthOf(today) && (
              <Button
                size="small"
                onClick={() => {
                  setMonth(monthOf(today))
                  setSelected(today)
                }}
                sx={{ minHeight: 24, py: 0 }}
              >
                חזרה להיום
              </Button>
            )}
          </Stack>
          <Tooltip title="החודש הבא">
            <IconButton aria-label="החודש הבא" onClick={() => go(1)}>
              <ChevronLeftIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap justifyContent="center" sx={{ mb: 1.5 }}>
          <Pill tone="success" label={`נוכח ${summary.present}`} />
          <Pill tone="warning" label={`היעדרות ${summary.absent}`} />
          <Pill tone="danger" label={`חסר דיווח ${summary.missing}`} />
          {summary.scheduled > 0 && <Pill tone="info" label={`מתוכנן ${summary.scheduled}`} />}
        </Stack>

        <Box sx={{ height: 4, mb: 1 }}>{loading && <LinearProgress sx={{ borderRadius: 99 }} />}</Box>

        {error ? (
          <ErrorState message={error} onRetry={fetchMonth} />
        ) : (
          <Box role="grid" aria-label={`לוח דיווחים ${fmtMonth(month)}`} aria-multiselectable={!!selectedDates && !!onDateSelect}>
            <Box role="row" sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5, mb: 0.5 }}>
              {WEEKDAYS.map((w) => (
                <Typography key={w} role="columnheader" variant="body2" sx={{ textAlign: 'center', fontWeight: 700, color: 'text.secondary' }}>
                  {w}
                </Typography>
              ))}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5 }}>
              {Array.from({ length: leading }, (_, i) => (
                <Box key={`pad-${i}`} aria-hidden />
              ))}
              {days.map((d) => {
                const r = reports?.get(d)
                const k = kindOf(r, d, today)
                const st = KIND_STYLE[k]
                const isToday = d === today
                const supportsFutureSelection = !!selectedDates && !!onDateSelect
                const isFuture = d > today
                const isFutureSelected = supportsFutureSelection && isFuture && selectedDates.includes(d)
                const isSel = isFuture ? isFutureSelected : d === selected
                const reason = r?.effective.reason
                const label = reason ? reason.label : k === 'missing' ? 'חסר' : ''
                const aria = `${fmtDayLong(d)}: ${reason ? `${reason.label}, ${STATE_LABEL[r!.state]}` : k === 'missing' ? 'חסר דיווח' : 'לא דווח'}${isFutureSelected ? ', נבחר לדיווח' : ''}`
                return (
                  <ButtonBase
                    key={d}
                    role="gridcell"
                    aria-selected={isSel}
                    aria-label={aria}
                    onClick={() => {
                      setSelected(d)
                      onDateSelect?.(d)
                    }}
                    sx={{
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      justifyContent: 'flex-start',
                      minWidth: 0,
                      width: '100%',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                      minHeight: { xs: 58, sm: 84 },
                      p: { xs: 0.5, sm: 0.75 },
                      borderRadius: 2,
                      bgcolor: isFutureSelected ? tokens.primarySoft : st.bg,
                      border: '1px solid',
                      borderStyle: r?.state === 'scheduled' ? 'dashed' : 'solid',
                      borderColor: isFutureSelected || r?.state === 'scheduled' ? tokens.primary : st.border,
                      outline: 'none',
                      boxShadow: isSel
                        ? `inset 0 0 0 2px ${tokens.primary}, ${tokens.liftShadow}`
                        : isToday
                          ? `inset 0 0 0 2px ${tokens.primaryDark}`
                          : 'none',
                      '&.Mui-focusVisible': { outline: `3px solid ${tokens.primary}` },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography
                        sx={{
                          fontSize: 13,
                          fontWeight: isToday ? 800 : 600,
                          color: isToday ? '#fff' : 'text.primary',
                          bgcolor: isToday ? tokens.primary : 'transparent',
                          borderRadius: 99,
                          minWidth: 22,
                          textAlign: 'center',
                          lineHeight: '22px',
                        }}
                      >
                        {parseDay(d).getUTCDate()}
                      </Typography>
                      {isFutureSelected ? (
                        <Box sx={{ width: 14, height: 14, flexShrink: 0, borderRadius: '50%', bgcolor: tokens.primary, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800 }} aria-hidden>
                          ✓
                        </Box>
                      ) : r?.state === 'pending_approval' ? (
                        <HourglassTopIcon sx={{ fontSize: 13, color: tokens.warning }} aria-hidden />
                      ) : r?.state === 'hr_final' ? (
                        <LockIcon sx={{ fontSize: 13, color: tokens.onSurfaceVariant }} aria-hidden />
                      ) : null}
                    </Stack>
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.25, mt: 0.25 }}>
                      {reason ? (
                        <ReasonIcon icon={reason.icon} sx={{ fontSize: { xs: 18, sm: 20 }, color: st.fg }} />
                      ) : k === 'missing' ? (
                        <ErrorOutlineIcon sx={{ fontSize: { xs: 16, sm: 18 }, color: st.fg }} aria-hidden />
                      ) : null}
                      {label && (
                        <Typography
                          sx={{
                            display: { xs: 'none', sm: '-webkit-box' },
                            fontSize: 11,
                            lineHeight: '13px',
                            fontWeight: 600,
                            color: st.fg,
                            textAlign: 'center',
                            overflow: 'hidden',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {label}
                        </Typography>
                      )}
                    </Box>
                  </ButtonBase>
                )
              })}
            </Box>
          </Box>
        )}

        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5, color: 'text.secondary' }} aria-label="מקרא">
          {(
            [
              ['present', 'נוכח'],
              ['absent', 'היעדרות'],
              ['missing', 'חסר דיווח'],
            ] as const
          ).map(([k, l]) => (
            <Stack key={k} direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: KIND_STYLE[k].bg, border: `1px solid ${KIND_STYLE[k].border}` }} />
              <Typography variant="caption">{l}</Typography>
            </Stack>
          ))}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 12, height: 12, borderRadius: 1, border: `1px dashed ${tokens.primary}` }} />
            <Typography variant="caption">מתוכנן</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <HourglassTopIcon sx={{ fontSize: 13, color: tokens.warning }} />
            <Typography variant="caption">ממתין לאישור</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <LockIcon sx={{ fontSize: 13 }} />
            <Typography variant="caption">סופי (שלישות)</Typography>
          </Stack>
        </Stack>
      </Card>

      <Card
        sx={{ p: 2, ...(fullBleedMobile && { borderRadius: { xs: 0, sm: 2 }, borderInlineWidth: { xs: 0, sm: 1 } }) }}
        aria-live="polite"
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="h4" component="h3">
            {fmtDayLong(selected)}
          </Typography>
          {renderActions?.(selected, selectedReport)}
        </Stack>
        {selectedReport ? (
          <LayersView report={selectedReport} />
        ) : (
          <Typography color="text.secondary">{selected < today ? 'לא נמצא דיווח ליום זה.' : 'טרם דווח ליום זה.'}</Typography>
        )}
      </Card>
    </Stack>
  )
}

/** A soldier's history as a month calendar in a dialog (commander / HR). */
export function CalendarDialog({
  open,
  onClose,
  title,
  today,
  load,
  renderActions,
  reloadKey,
  initialDate,
}: {
  open: boolean
  onClose: () => void
  title: string
  today: string
  load: (from: string, to: string) => Promise<Report[]>
  renderActions?: (date: string, report: Report | null) => ReactNode
  reloadKey?: number
  initialDate?: string
}) {
  return (
    <AppDialog open={open} onClose={onClose} title={title} maxWidth="md">
      {open && <MonthCalendar today={today} load={load} renderActions={renderActions} reloadKey={reloadKey} initialDate={initialDate} />}
    </AppDialog>
  )
}
