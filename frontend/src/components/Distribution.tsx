import { Box, Card, Stack, Typography } from '@mui/material'
import type { RosterRow } from '../api/types'
import { tokens } from '../theme'
import { ReasonIcon } from './common'

// Blues for "present" statuses, ambers for absences, red for missing. Each row also carries a text label and icon.
const PRESENT = ['#0052ff', '#4d7fff', '#99b4ff']
const ABSENT = ['#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#b45309']

/** Attendance distribution for a roster: stacked bar + labelled legend. */
export function Distribution({ rows, title = 'התפלגות נוכחות וסטטוס' }: { rows: RosterRow[]; title?: string }) {
  const groups = new Map<string, { label: string; icon?: string | null; present: boolean; count: number }>()
  let missing = 0
  for (const r of rows) {
    const reason = r.report?.effective.reason
    if (!reason) {
      missing++
      continue
    }
    const g = groups.get(reason.code) ?? { label: reason.label, icon: reason.icon, present: reason.is_present, count: 0 }
    g.count++
    groups.set(reason.code, g)
  }
  const sorted = [...groups.values()].sort((a, b) => Number(b.present) - Number(a.present) || b.count - a.count)
  let p = 0
  let a = 0
  const series = [
    ...sorted.map((g) => ({ ...g, color: g.present ? PRESENT[p++ % PRESENT.length] : ABSENT[a++ % ABSENT.length] })),
    ...(missing ? [{ label: 'לא דיווחו עדיין', icon: null, present: false, count: missing, color: tokens.danger }] : []),
  ]
  const total = rows.length || 1

  return (
    <Card sx={{ p: 2 }}>
      <Typography variant="h4" component="h2" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {rows.length === 0 ? (
        <Typography color="text.secondary">אין נתונים</Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', gap: '2px', mb: 1.5 }} aria-hidden>
            {series.map((s) => (
              <Box key={s.label} sx={{ flex: s.count, bgcolor: s.color }} />
            ))}
          </Box>
          <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }} spacing={0.75}>
            {series.map((s) => (
              <Stack
                component="li"
                key={s.label}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={s.color === tokens.danger ? { bgcolor: tokens.dangerSoft, borderRadius: 2, px: 1, py: 0.5, color: tokens.danger } : { px: 1 }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: 99, bgcolor: s.color, flexShrink: 0 }} />
                {s.icon && <ReasonIcon icon={s.icon} sx={{ fontSize: 16, color: 'text.secondary' }} />}
                <Typography sx={{ flex: 1, fontSize: 14 }}>{s.label}</Typography>
                <Typography sx={{ fontWeight: 700, width: 32, textAlign: 'end' }}>{s.count}</Typography>
                <Typography sx={{ width: 52, textAlign: 'end', color: 'text.secondary', fontSize: 13 }}>
                  {((s.count / total) * 100).toFixed(1)}%
                </Typography>
              </Stack>
            ))}
          </Stack>
        </>
      )}
    </Card>
  )
}
