import SendIcon from '@mui/icons-material/Send'
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api/client'
import type { Reason } from '../api/types'
import { addDays, daysBetween, fmtDay } from '../lib/i18n'
import { AppDialog } from './dialogs'
import { ReasonPicker, reasonError, type ReasonValue } from './ReasonPicker'

const MAX_DAYS = 31

/** Report one status for a range of days in a single step (e.g. a vacation or a course). */
export function RangeReportDialog({
  open,
  onClose,
  today,
  startDate,
  reasons,
  onDone,
}: {
  open: boolean
  onClose: () => void
  today: string
  startDate: string
  reasons: Reason[]
  onDone: (result: { submitted: string[]; skipped_locked: string[] }) => void
}) {
  const [from, setFrom] = useState(startDate)
  const [to, setTo] = useState(addDays(startDate, 4))
  const [value, setValue] = useState<ReasonValue>({ reasonId: null, notes: '' })
  const [showErrors, setShowErrors] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const start = startDate < today ? today : startDate
    setFrom(start)
    setTo(addDays(start, 4))
    setValue({ reasonId: null, notes: '' })
    setShowErrors(false)
    setError(null)
  }, [open, startDate, today])

  const count = to >= from ? daysBetween(from, to) + 1 : 0
  const rangeError =
    from < today ? 'לא ניתן לדווח על תאריך שעבר.' : to < from ? 'תאריך הסיום לפני תאריך ההתחלה.' : count > MAX_DAYS ? `ניתן לדווח עד ${MAX_DAYS} ימים בבת אחת.` : null

  const submit = async () => {
    const problem = rangeError ?? reasonError(reasons, value)
    if (problem) {
      setShowErrors(true)
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await api.submitMyReportRange({ date_from: from, date_to: to, reason_id: value.reasonId!, notes: value.notes.trim() || null })
      onDone(r)
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
      title="דיווח לכמה ימים"
      maxWidth="md"
      actions={
        <>
          <Button onClick={onClose}>ביטול</Button>
          <Button variant="contained" startIcon={<SendIcon />} onClick={submit} disabled={busy || count === 0}>
            {busy ? 'שומר…' : count > 0 ? `דיווח ל-${count} ימים` : 'דיווח'}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <TextField
            type="date"
            label="מתאריך"
            value={from}
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              setFrom(v)
              if (to < v) setTo(v)
            }}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today } }}
          />
          <TextField
            type="date"
            label="עד תאריך"
            value={to}
            onChange={(e) => e.target.value && setTo(e.target.value)}
            error={showErrors && !!rangeError}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from } }}
          />
        </Box>
        <Typography color={rangeError ? 'error' : 'text.secondary'} variant="body2" aria-live="polite">
          {rangeError ?? `${count} ימים: ${fmtDay(from)} – ${fmtDay(to)}. ימים שכבר דווחו יעודכנו; ימים שננעלו ע״י השלישות לא ישתנו.`}
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <ReasonPicker reasons={reasons} value={value} onChange={setValue} showErrors={showErrors} idPrefix="range" />
      </Stack>
    </AppDialog>
  )
}
