import HistoryIcon from '@mui/icons-material/History'
import RadarIcon from '@mui/icons-material/Radar'
import { Box, Button, Card, Chip, Divider, Stack, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '../api/client'
import type { Anomalies, AnomalySignal, Soldier } from '../api/types'
import { useToast } from './AppShell'
import { ErrorState, Loading, SectionTitle } from './common'
import { fmtDay } from '../lib/i18n'

const SIGNAL_LABEL: Record<AnomalySignal, string> = {
  notes_mismatch: 'הערות סותרות לסטטוס',
  layer_conflict: 'סתירה בין חייל למפקד',
  absence_pattern: 'דפוס היעדרות חריג',
}

const severity = (s: number): { label: string; color: 'error' | 'warning' | 'default' } =>
  s >= 2.5 ? { label: 'חמור', color: 'error' } : s >= 1.5 ? { label: 'דורש בדיקה', color: 'warning' } : { label: 'חריגה קלה', color: 'default' }

/** Soldiers flagged by the nightly Jev scan over the last 20 days of reports. */
export function AnomaliesCard({ onOpenHistory }: { onOpenHistory: (soldier: Soldier) => void }) {
  const toast = useToast()
  const [data, setData] = useState<Anomalies | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const load = useCallback(() => {
    setError(null)
    api.hrAnomalies().then(setData, (e) => setError(errorMessage(e)))
  }, [])
  useEffect(load, [load])

  const scan = async () => {
    setScanning(true)
    try {
      setData(await api.hrAnomalyScan())
      toast({ severity: 'success', message: 'הסריקה הושלמה' })
    } catch (e) {
      toast({ severity: 'error', message: errorMessage(e) })
    } finally {
      setScanning(false)
    }
  }

  const run = data?.run
  return (
    <>
      <SectionTitle
        action={
          data?.configured && (
            <Button size="small" startIcon={<RadarIcon />} onClick={scan} disabled={scanning}>
              {scanning ? 'סורק…' : 'סריקה עכשיו'}
            </Button>
          )
        }
      >
        חריגות בדיווחים
      </SectionTitle>
      <Card sx={{ p: 2 }}>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !data ? (
          <Loading />
        ) : (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {!data.configured
                ? 'סריקת החריגות הלילית אינה מופעלת (חסר מפתח API למודל Jev).'
                : run
                  ? `סריקה אחרונה (${run.trigger === 'nightly' ? 'לילית' : 'ידנית'}) של הדיווחים בין ${fmtDay(run.window_from)} ל-${fmtDay(run.window_to)}`
                  : 'טרם בוצעה סריקה. הסריקה רצה כל לילה ובודקת את 20 הימים האחרונים של כל חייל.'}
            </Typography>
            {run && data.items.length === 0 && <Typography>לא נמצאו חריגות ביחידה 🎉</Typography>}
            {data.items.map((a, i) => {
              const sev = severity(a.severity)
              return (
                <Box key={a.soldier.id}>
                  {i > 0 && <Divider sx={{ mb: 1.5 }} />}
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>
                        {a.soldier.rank} {a.soldier.full_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        <bdi>{a.soldier.personal_number}</bdi>
                        {a.soldier.role_title && ` · ${a.soldier.role_title}`}
                      </Typography>
                    </Box>
                    <Button size="small" variant="outlined" startIcon={<HistoryIcon />} onClick={() => onOpenHistory(a.soldier)} sx={{ flexShrink: 0 }}>
                      היסטוריה
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={0.75} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                    <Chip size="small" color={sev.color} label={`${sev.label} · ${Math.round(a.score * 100)}%`} />
                    {a.signals.map((s) => (
                      <Chip key={s} size="small" variant="outlined" label={SIGNAL_LABEL[s]} />
                    ))}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>
                    {a.facts.join(' · ')}
                  </Typography>
                </Box>
              )
            })}
          </Stack>
        )}
      </Card>
    </>
  )
}
