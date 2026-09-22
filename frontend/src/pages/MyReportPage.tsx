import AlarmIcon from '@mui/icons-material/Alarm'
import ApartmentIcon from '@mui/icons-material/Apartment'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DateRangeIcon from '@mui/icons-material/DateRange'
import EventIcon from '@mui/icons-material/Event'
import LockIcon from '@mui/icons-material/Lock'
import SendIcon from '@mui/icons-material/Send'
import { Alert, Box, Button, ButtonBase, Card, Collapse, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { Report } from '../api/types'
import { useSession } from '../auth'
import { useToast } from '../components/AppShell'
import { ErrorState, Loading, PersonAvatar, Pill, StateChip } from '../components/common'
import { LayersView } from '../components/dialogs'
import { ReasonPicker, reasonError, type ReasonValue } from '../components/ReasonPicker'
import { addDays, fmtDay, fmtDayLong, fmtDayNum, fmtWeekdayShort, relativeDayLabel, STATE_LABEL } from '../lib/i18n'
import { tokens } from '../theme'

export default function MyReportPage() {
  const { me, meta } = useSession()
  const toast = useToast()
  const today = meta.today
  const [params, setParams] = useSearchParams()
  const selected = params.get('date') ?? today
  const setSelected = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true })

  const [reports, setReports] = useState<Report[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [atBase, setAtBase] = useState<boolean | null>(null)
  const [value, setValue] = useState<ReasonValue>({ reasonId: null, notes: '' })
  const [showErrors, setShowErrors] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [multiMode, setMultiMode] = useState(false)
  const [selectedDates, setSelectedDates] = useState<string[]>([])

  const atBaseReason = meta.reasons.find((r) => r.code === 'at_base')
  const absenceReasons = useMemo(() => meta.reasons.filter((r) => r.code !== 'at_base'), [meta.reasons])

  const load = useCallback(() => {
    setLoadError(null)
    api.myReports(addDays(today, -30), addDays(today, 60)).then(setReports, (e) => setLoadError(errorMessage(e)))
  }, [today])
  useEffect(load, [load])

  const byDate = useMemo(() => new Map((reports ?? []).map((r) => [r.report_date, r])), [reports])
  const current = byDate.get(selected) ?? null
  const isPast = selected < today
  const isFuture = selected > today
  const locked = current?.state === 'hr_final'
  const editable = !isPast && !locked
  const reportable = multiMode ? selectedDates.length > 0 : editable

  const toggleMultiMode = (enabled: boolean) => {
    setMultiMode(enabled)
    setSelectedDates(enabled ? [selected < today ? today : selected] : [])
    setAtBase(null)
    setShowErrors(false)
    setSubmitError(null)
  }

  const toggleDate = (date: string) => {
    setSelectedDates((dates) => (dates.includes(date) ? dates.filter((d) => d !== date) : [...dates, date].sort()))
    setAtBase(null)
    setShowErrors(false)
    setSubmitError(null)
  }

  // Reset the form when switching dates.
  useEffect(() => {
    setAtBase(null)
    setShowErrors(false)
    setSubmitError(null)
    const r = byDate.get(selected)
    const soldier = r?.soldier_layer
    setValue({ reasonId: soldier && soldier.reason.code !== 'at_base' ? soldier.reason.id : null, notes: soldier?.notes ?? '' })
  }, [selected, byDate])

  const submit = async (reasonId: number, notes: string | null) => {
    const dates = multiMode ? selectedDates : [selected]
    if (!dates.length) {
      setSubmitError('יש לבחור לפחות יום אחד לדיווח.')
      return
    }
    setBusy(true)
    setSubmitError(null)
    try {
      if (multiMode) {
        const result = await api.submitMyReportDates({ report_dates: dates, reason_id: reasonId, notes })
        load()
        setMultiMode(false)
        setSelectedDates([])
        setSelected(dates[0])
        toast({
          severity: result.skipped_locked.length ? 'warning' : 'success',
          message:
            `הדיווח נשמר ל-${result.submitted.length} ימים` +
            (result.skipped_locked.length ? ` (${result.skipped_locked.length} ימים נעולים ע״י השלישות לא שונו)` : ''),
        })
      } else {
        const r = await api.submitMyReport({ report_date: selected, reason_id: reasonId, notes })
        setReports((prev) => [r, ...(prev ?? []).filter((x) => x.id !== r.id)])
        setAtBase(null)
        toast({
          severity: 'success',
          message: r.state === 'scheduled' ? `הדיווח ל-${fmtDay(selected)} נשמר ויישלח לאישור ב-08:00 באותו יום` : 'הדיווח נשלח לאישור המפקד',
        })
      }
    } catch (e) {
      setSubmitError(errorMessage(e))
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

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  const yesterday = byDate.get(addDays(today, -1))

  if (loadError) return <ErrorState message={loadError} onRetry={load} />
  if (!reports) return <Loading />

  return (
    <Stack spacing={2} sx={{ maxWidth: 860, mx: 'auto' }}>
      {/* Soldier context card */}
      <Card sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <PersonAvatar name={me.full_name} size={48} />
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h4" component="p">
                  {me.full_name}
                </Typography>
                {me.rank && <Pill tone="primary" label={me.rank} />}
              </Stack>
              <Typography variant="body2" color="text.secondary" noWrap>
                {me.unit.name} · מ.א <bdi>{me.personal_number}</bdi>
                {me.commander && ` · מפקד: ${me.commander.full_name}`}
              </Typography>
            </Box>
          </Stack>
          <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {fmtDay(today)}
            </Typography>
            {yesterday?.effective.reason && <Pill label={`${yesterday.effective.reason.label} (אתמול)`} />}
          </Stack>
        </Stack>

        {!byDate.get(today) && (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            role="alert"
            sx={{ mt: 1.5, p: 1.25, borderRadius: 2, bgcolor: '#fff3f2', border: '1px solid #ffdad6' }}
          >
            <AlarmIcon sx={{ color: 'error.main', fontSize: 20 }} />
            <Typography variant="body2">טרם דיווחת נוכחות להיום</Typography>
          </Stack>
        )}

        {/* Week strip */}
        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 3, bgcolor: '#f0f4ff', border: '1px solid #d2d9f4' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <DateRangeIcon sx={{ color: tokens.primary }} />
              <Typography variant="h6" component="h2">
                דיווח לשבוע הקרוב
              </Typography>
            </Stack>
            <FormControlLabel
              label="בחירת כמה ימים"
              labelPlacement="start"
              control={<Switch checked={multiMode} onChange={(e) => toggleMultiMode(e.target.checked)} inputProps={{ 'aria-label': 'בחירת כמה ימים' }} />}
              sx={{ m: 0, gap: 0.5, '& .MuiFormControlLabel-label': { fontSize: 13, fontWeight: 600 } }}
            />
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            {multiMode ? (
              <>
                <Typography variant="body2" color="text.secondary">
                  לחצו על הימים שתרצו לסמן
                </Typography>
                <Pill tone="primary" label={selectedDates.length === 1 ? 'נבחר יום אחד' : `נבחרו ${selectedDates.length} ימים`} />
              </>
            ) : (
              <TextField
                type="date"
                size="small"
                label="תאריך אחר"
                value={selected}
                onChange={(e) => e.target.value && setSelected(e.target.value)}
                sx={{ width: 160, bgcolor: '#fff', mr: 'auto' }}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: addDays(today, -30), max: addDays(today, 60) } }}
              />
            )}
          </Stack>
          <Box
            role={multiMode ? 'group' : 'tablist'}
            aria-label={multiMode ? 'בחירת ימים לדיווח' : 'בחירת תאריך דיווח'}
            sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75 }}
          >
            {week.map((d) => {
              const active = multiMode ? selectedDates.includes(d) : d === selected
              const r = byDate.get(d)
              const sub = relativeDayLabel(d, today) || (r ? (r.state === 'scheduled' ? 'מתוכנן' : 'דווח') : '—')
              return (
                <ButtonBase
                  key={d}
                  role={multiMode ? 'checkbox' : 'tab'}
                  aria-checked={multiMode ? active : undefined}
                  aria-selected={multiMode ? undefined : active}
                  aria-label={`${fmtDayLong(d)}${r ? ', ' + STATE_LABEL[r.state] : ', לא דווח'}`}
                  onClick={() => (multiMode ? toggleDate(d) : setSelected(d))}
                  sx={{
                    flexDirection: 'column',
                    py: 1.25,
                    minHeight: 68,
                    borderRadius: 3,
                    bgcolor: active ? tokens.primary : '#fff',
                    color: active ? '#fff' : 'text.primary',
                    border: '1px solid',
                    borderColor: active ? tokens.primary : tokens.surfaceContainer,
                    boxShadow: active ? '0 6px 14px rgba(0,82,255,.25)' : 'none',
                    '&.Mui-focusVisible': { outline: `3px solid ${tokens.primaryDark}`, outlineOffset: 2 },
                  }}
                >
                  <Typography sx={{ fontSize: 13, opacity: 0.85 }}>{fmtWeekdayShort(d)}</Typography>
                  <Typography sx={{ fontSize: 17, fontWeight: 700 }}>{fmtDayNum(d)}</Typography>
                  <Stack direction="row" alignItems="center" spacing={0.25}>
                    {r && !relativeDayLabel(d, today) && (
                      <CheckCircleIcon sx={{ fontSize: 11, color: active ? '#fff' : tokens.success }} aria-hidden />
                    )}
                    <Typography sx={{ fontSize: 10, opacity: 0.9 }}>{sub}</Typography>
                  </Stack>
                </ButtonBase>
              )
            })}
          </Box>
        </Box>
      </Card>

      {/* Selected date status */}
      {multiMode ? (
        <Card sx={{ p: 2, borderColor: tokens.primary, bgcolor: '#f8faff' }} aria-live="polite">
          <Typography variant="body2" color="text.secondary">
            ימים שנבחרו
          </Typography>
          <Typography variant="h3" component="h2" sx={{ mt: 0.25 }}>
            {selectedDates.length ? selectedDates.map(fmtDayLong).join(' · ') : 'עדיין לא נבחרו ימים'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            הדיווח שתבחרו יחול על כל הימים המסומנים. ימים שננעלו ע״י השלישות לא ישתנו.
          </Typography>
        </Card>
      ) : (
        <Card sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1} sx={{ mb: current ? 1.5 : 0 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                תאריך הדיווח
              </Typography>
              <Typography variant="h3" component="h2">
                {fmtDayLong(selected)} {relativeDayLabel(selected, today) && `(${relativeDayLabel(selected, today)})`}
              </Typography>
            </Box>
            {current ? <StateChip state={current.state} /> : <Pill tone={isPast ? 'neutral' : 'danger'} label="טרם דווח" />}
          </Stack>
          {current && (
            <>
              {current.state === 'scheduled' && (
                <Alert icon={<EventIcon />} severity="info" sx={{ mb: 1.5 }}>
                  דיווח עתידי: יישלח אוטומטית לאישור המפקד ב-08:00 בתאריך {fmtDay(current.report_date)}.
                </Alert>
              )}
              {current.state === 'pending_approval' && (
                <Alert severity="warning" sx={{ mb: 1.5 }}>
                  הדיווח נשלח וממתין לאישור המפקד.
                </Alert>
              )}
              {locked && (
                <Alert icon={<LockIcon />} severity="info" sx={{ mb: 1.5 }}>
                  הדיווח עודכן ע״י השלישות ונעול. לשינוי יש לפנות לשלישות.
                </Alert>
              )}
              <LayersView report={current} />
            </>
          )}
          {isPast && !current && (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              לא נמצא דיווח לתאריך זה. דיווח על תאריך שעבר מתבצע ע״י השלישות.
            </Typography>
          )}
        </Card>
      )}

      {reportable && (
        <>
          {/* "Are you at the base?" hero */}
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
                  {multiMode ? 'האם אתה בבסיס בימים שבחרת?' : 'האם אתה בבסיס?'}
                </Typography>
                <Typography sx={{ opacity: 0.9, fontSize: 14 }}>
                  {multiMode
                    ? selectedDates.length === 1
                      ? 'דיווח עבור יום אחד'
                      : `דיווח אחד עבור ${selectedDates.length} ימים`
                    : current
                      ? 'אפשר לעדכן את הדיווח. שינוי דיווח מאושר יחזיר אותו לאישור המפקד.'
                      : `דיווח עבור ${fmtDayLong(selected)}`}
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
                onClick={() => setAtBase(atBase === false ? null : false)}
                sx={{ flex: 1, color: '#fff', borderColor: 'rgba(255,255,255,.6)', fontSize: 16, '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.1)' } }}
              >
                לא, אני לא בבסיס
              </Button>
            </Stack>
            {(multiMode ? selectedDates.some((d) => d > today) : isFuture) && (
              <Typography sx={{ fontSize: 12, opacity: 0.85, mt: 1.25 }}>
                דיווח עתידי יישמר כ״מתוכנן״ ויועבר לאישור ב-08:00 בתאריך הדיווח.
              </Typography>
            )}
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
                {busy
                  ? 'שולח…'
                  : multiMode
                    ? selectedDates.length === 1
                      ? 'שמירת דיווח ליום אחד'
                      : `שמירת דיווח ל-${selectedDates.length} ימים`
                    : isFuture
                      ? 'שמירת דיווח עתידי'
                      : 'שליחת דיווח לאישור המפקד'}
              </Button>
            </Card>
          </Collapse>
          {submitError && atBase !== false && <Alert severity="error">{submitError}</Alert>}
        </>
      )}

    </Stack>
  )
}
