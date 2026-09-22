import AccessTimeIcon from '@mui/icons-material/AccessTime'
import ApartmentIcon from '@mui/icons-material/Apartment'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import SendIcon from '@mui/icons-material/Send'
import { Alert, Box, Button, Card, Collapse, Stack, Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, errorCode, errorMessage } from '../api/client'
import type { Report } from '../api/types'
import { useSession } from '../auth'
import { useToast } from '../components/AppShell'
import { ErrorState, Loading, Pill } from '../components/common'
import { ReasonPicker, reasonError, type ReasonValue } from '../components/ReasonPicker'
import { STATE_LABEL, parseDay } from '../lib/i18n'
import { tokens } from '../theme'

function isLocked(report: Report | null | undefined) {
  return report?.state === 'hr_final' || report?.state === 'approved' || report?.state === 'sent_to_hr' || !!report?.commander_layer
}

const fmtStatusDate = (date: string) =>
  new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parseDay(date))

function LocationPrompt() {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: { xs: 'visible', md: 'hidden' },
        flex: 1,
        minHeight: { xs: 300, sm: 340 },
        mx: { xs: -2, md: -3 },
        mb: { xs: -14, md: -6 },
        color: '#6473a1',
        textAlign: 'center',
      }}
    >
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={1.5}
        sx={{ position: 'absolute', inset: 0, bottom: { xs: 96, sm: 112 }, zIndex: 1, px: 2 }}
      >
        <Box
          sx={{
            width: 84,
            height: 84,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'radial-gradient(circle, rgba(221,225,255,.95) 0%, rgba(232,237,255,.55) 68%, rgba(245,247,255,0) 70%)',
          }}
        >
          <LocationOnOutlinedIcon sx={{ fontSize: 46, color: '#5870ac' }} />
        </Box>
        <Typography sx={{ fontSize: { xs: 20, sm: 23 }, fontWeight: 700 }}>אז איפה אנחנו נמצאים היום?</Typography>
      </Stack>

      <Box
        aria-hidden
        sx={{
          position: { xs: 'fixed', md: 'absolute' },
          zIndex: 0,
          pointerEvents: 'none',
          width: { xs: '100%', md: '130%' },
          height: 150,
          insetInlineStart: { xs: 0, md: '-15%' },
          bottom: { xs: 'calc(68px + env(safe-area-inset-bottom))', md: 0 },
          borderRadius: '50% 50% 0 0',
          bgcolor: 'rgba(221,225,255,.68)',
          boxShadow: '0 -42px 0 rgba(232,237,255,.72)',
        }}
      />
    </Box>
  )
}

function StatusScreen({ report, onEdit }: { report: Report; onEdit?: () => void }) {
  const reason = report.effective.reason
  const status = reason?.code === 'at_base' ? 'בבסיס' : reason?.label ?? 'הדיווח נשמר'
  const tone = report.state === 'pending_approval' ? 'warning' : report.state === 'approved' ? 'success' : report.state === 'scheduled' ? 'info' : 'primary'

  return (
    <Box
      sx={{
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        mx: { xs: -2, md: -3 },
        mt: -2,
        mb: { xs: -14, md: -6 },
        px: 2,
        pt: { xs: 4, sm: 6 },
        pb: { xs: 12, md: 7 },
        minHeight: { xs: 'calc(100dvh - 140px)', md: 'calc(100dvh - 72px)' },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        background:
          'radial-gradient(circle at 50% 24%, rgba(214,225,255,.85), rgba(245,247,255,0) 36%), linear-gradient(180deg, #f8faff 0%, #f2f5ff 100%)',
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          zIndex: -1,
          width: '130%',
          height: 150,
          insetInlineStart: '-15%',
          bottom: -72,
          borderRadius: '50% 50% 0 0',
          bgcolor: 'rgba(221,225,255,.55)',
          boxShadow: '0 -34px 0 rgba(232,237,255,.5)',
        }}
      />

      <Box sx={{ position: 'relative', mb: 3 }}>
        <Box
          sx={{
            width: { xs: 172, sm: 196 },
            height: { xs: 172, sm: 196 },
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'rgba(221,225,255,.72)',
            color: '#5572c2',
          }}
        >
          <EventAvailableIcon sx={{ fontSize: { xs: 96, sm: 108 } }} />
        </Box>
        <Box
          sx={{
            position: 'absolute',
            insetInlineEnd: 7,
            bottom: 12,
            width: 48,
            height: 48,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: '#edf1ff',
            color: '#5572c2',
            border: '4px solid #f5f7ff',
          }}
        >
          <AccessTimeIcon sx={{ fontSize: 32 }} />
        </Box>
      </Box>

      <Box aria-hidden sx={{ position: 'absolute', insetInlineStart: { xs: 42, sm: '18%' }, top: '29%', height: 170, borderInlineStart: '2px dashed #c9d8ff' }}>
        {[0, 72, 144].map((top) => (
          <Box key={top} sx={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', bgcolor: '#c9d8ff', insetInlineStart: -9, top }} />
        ))}
      </Box>
      <Box aria-hidden sx={{ position: 'absolute', insetInlineEnd: { xs: 42, sm: '18%' }, top: '29%', height: 170, borderInlineStart: '2px dashed #c9d8ff' }}>
        {[0, 72, 144].map((top) => (
          <Box key={top} sx={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', bgcolor: '#c9d8ff', insetInlineStart: -9, top }} />
        ))}
      </Box>

      <Typography color="text.secondary" sx={{ fontSize: 18, fontWeight: 500 }}>
        הסטטוס שלך להיום
      </Typography>
      <Typography component="h2" sx={{ mt: 0.5, fontSize: { xs: 28, sm: 34 }, lineHeight: 1.2, fontWeight: 700, color: '#16264f' }}>
        {fmtStatusDate(report.report_date)}
      </Typography>
      <Typography sx={{ mt: 1, fontSize: { xs: 40, sm: 48 }, lineHeight: 1.1, fontWeight: 800, color: tokens.primary }}>
        {status}
      </Typography>
      <Pill
        tone={tone}
        icon={<AccessTimeIcon />}
        label={STATE_LABEL[report.state]}
        sx={{ mt: 2, height: 36, px: 1.25, fontSize: 14, '& .MuiChip-icon': { fontSize: 21 } }}
      />
      {onEdit && (
        <Button size="small" variant="text" startIcon={<EditOutlinedIcon />} onClick={onEdit} sx={{ mt: 2, color: 'text.secondary' }}>
          עריכת דיווח
        </Button>
      )}
    </Box>
  )
}

export default function MyReportPage() {
  const { meta } = useSession()
  const toast = useToast()
  const today = meta.today
  const [reports, setReports] = useState<Report[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [atBase, setAtBase] = useState<boolean | null>(null)
  const [value, setValue] = useState<ReasonValue>({ reasonId: null, notes: '' })
  const [showErrors, setShowErrors] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)

  const atBaseReason = meta.reasons.find((reason) => reason.code === 'at_base')
  const absenceReasons = useMemo(() => meta.reasons.filter((reason) => reason.code !== 'at_base'), [meta.reasons])

  const load = useCallback(() => {
    setLoadError(null)
    api.myReports(today, today).then(setReports, (error) => setLoadError(errorMessage(error)))
  }, [today])
  useEffect(load, [load])
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])

  const byDate = useMemo(() => new Map((reports ?? []).map((report) => [report.report_date, report])), [reports])
  const current = byDate.get(today) ?? null
  const locked = isLocked(current)

  const submit = async (reasonId: number, notes: string | null) => {
    setBusy(true)
    setSubmitError(null)
    try {
      const report = await api.submitMyReport({ report_date: today, reason_id: reasonId, notes })
      setReports((previous) => [report, ...(previous ?? []).filter((item) => item.id !== report.id)])
      setAtBase(null)
      setEditing(false)
      toast({ severity: 'success', message: 'הדיווח נשלח לאישור המפקד' })
    } catch (error) {
      setSubmitError(errorMessage(error))
      if (errorCode(error) === 'REPORT_LOCKED_BY_COMMANDER' || errorCode(error) === 'REPORT_LOCKED_BY_HR') load()
    } finally {
      setBusy(false)
    }
  }

  const submitAbsence = () => {
    const problem = reasonError(absenceReasons, value)
    if (problem) {
      setShowErrors(true)
      setSubmitError(problem)
      return
    }
    submit(value.reasonId!, value.notes.trim() || null)
  }

  if (loadError) return <ErrorState message={loadError} onRetry={load} />
  if (!reports) return <Loading />
  if (current && !editing) {
    return (
      <StatusScreen
        report={current}
        onEdit={locked ? undefined : () => {
          setAtBase(null)
          setShowErrors(false)
          setSubmitError(null)
          setEditing(true)
        }}
      />
    )
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 860, mx: 'auto', minHeight: { xs: 'calc(100dvh - 172px)', md: 'calc(100dvh - 120px)' } }}>
      <Box
        sx={{
          p: 2.5,
          borderRadius: 4,
          background: tokens.heroGradient,
          color: '#fff',
          boxShadow: '0 12px 28px rgba(0,82,255,.25)',
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: 'rgba(255,255,255,.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <ApartmentIcon sx={{ fontSize: 30 }} />
          </Box>
          <Box>
            <Typography component="h2" sx={{ fontSize: 22, fontWeight: 700 }}>
              האם אתה בבסיס?
            </Typography>
            <Typography sx={{ opacity: 0.9, fontSize: 14 }}>
              {current ? 'אפשר לעדכן את הדיווח כל עוד לא אושר או עודכן ע״י המפקד.' : 'דיווח נוכחות להיום'}
            </Typography>
          </Box>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 2 }}>
          <Button
            size="large"
            disabled={busy || !atBaseReason}
            onClick={() => atBaseReason && submit(atBaseReason.id, null)}
            startIcon={<CheckCircleIcon />}
            sx={{ flex: 1, bgcolor: '#fff', color: tokens.primary, fontSize: 18, fontWeight: 700, '&:hover': { bgcolor: '#eef2ff' } }}
          >
            כן, אני בבסיס
          </Button>
          <Button
            size="large"
            variant="outlined"
            aria-expanded={atBase === false}
            aria-controls="absence-form"
            onClick={() => {
              if (atBase === false) {
                setAtBase(null)
                return
              }
              const soldier = current?.soldier_layer
              setValue({ reasonId: soldier && soldier.reason.code !== 'at_base' ? soldier.reason.id : null, notes: soldier?.notes ?? '' })
              setShowErrors(false)
              setSubmitError(null)
              setAtBase(false)
            }}
            sx={{ flex: 1, color: '#fff', borderColor: 'rgba(255,255,255,.6)', fontSize: 16, '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.1)' } }}
          >
            לא, אני לא בבסיס
          </Button>
        </Stack>
      </Box>

      <Collapse in={atBase === false} unmountOnExit>
        <Card id="absence-form" sx={{ p: 2 }}>
          <Typography variant="h4" component="h2" sx={{ mb: 1.5 }}>
            בחירת סיבת היעדרות
          </Typography>
          {submitError && (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {submitError}
            </Alert>
          )}
          <ReasonPicker reasons={absenceReasons} value={value} onChange={setValue} showErrors={showErrors} />
          <Button fullWidth variant="contained" size="large" startIcon={<SendIcon />} onClick={submitAbsence} disabled={busy} sx={{ mt: 2 }}>
            {busy ? 'שולח…' : 'שליחת דיווח לאישור המפקד'}
          </Button>
        </Card>
      </Collapse>
      {submitError && atBase !== false && <Alert severity="error">{submitError}</Alert>}

      {atBase !== false && <LocationPrompt />}
    </Stack>
  )
}
