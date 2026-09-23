import CampaignIcon from '@mui/icons-material/Campaign'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import EditLocationAltIcon from '@mui/icons-material/EditLocationAlt'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import LockIcon from '@mui/icons-material/Lock'
import { Alert, Box, Button, Card, Chip, Divider, LinearProgress, Stack, TextField, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '../api/client'
import type { CheckinResponseRow } from '../api/types'
import { fmtDateTime } from '../lib/i18n'
import { tokens } from '../theme'
import { useToast, useUnread } from './AppShell'
import { ErrorState, Loading, Pill } from './common'

interface Latest {
  requestId: number
  /** Set when I sent the request (so I can close it). */
  issuedId: number | null
  from: string
  created_at: string
  message: string | null
  is_open: boolean
  rows: CheckinResponseRow[]
}

const POLL_MS = 20000

/** Latest ירוק בעיניים request (mine, or my commander's) with the answer of every subordinate, plus sending a new one. */
export function CheckinStatusCard() {
  const toast = useToast()
  const { refresh: refreshUnread } = useUnread()
  const [latest, setLatest] = useState<Latest | null | undefined>(undefined)
  const [subordinates, setSubordinates] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingOnly, setPendingOnly] = useState(false)
  // Answering on behalf of a subordinate: whose row is open + the text.
  const [fillFor, setFillFor] = useState<number | null>(null)
  const [fillText, setFillText] = useState('')

  const load = useCallback(async () => {
    try {
      const [issued, received] = await Promise.all([api.checkinsIssued(), api.checkinsReceived()])
      setSubordinates(issued.subordinate_count)
      const mine = issued.requests[0]
      const theirs = received.find((r) => r.total > 0)
      if (mine && (!theirs || mine.created_at >= theirs.request.created_at)) {
        const d = await api.checkinDetail(mine.id)
        setLatest({ requestId: d.id, issuedId: d.id, from: 'שלי', created_at: d.created_at, message: d.message, is_open: d.is_open, rows: d.responses })
      } else if (theirs) {
        const r = theirs.request
        setLatest({ requestId: r.id, issuedId: null, from: r.commander.full_name, created_at: r.created_at, message: r.message, is_open: r.is_open, rows: theirs.responses })
      } else {
        setLatest(null)
      }
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])
  useEffect(() => {
    load()
    const t = window.setInterval(load, POLL_MS)
    return () => window.clearInterval(t)
  }, [load])

  const send = async () => {
    setBusy(true)
    try {
      const d = await api.checkinCreate(message.trim())
      toast({ severity: 'success', message: `הבקשה נשלחה ל-${d.total} חיילים` })
      setMessage('')
      setComposing(false)
      await load()
      refreshUnread()
    } catch (e) {
      toast({ severity: 'error', message: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const close = async () => {
    try {
      await api.checkinClose(latest!.issuedId!)
      toast({ severity: 'success', message: 'הבקשה נסגרה' })
      load()
    } catch (e) {
      toast({ severity: 'error', message: errorMessage(e) })
    }
  }

  const fill = async (soldierId: number) => {
    setBusy(true)
    try {
      await api.checkinRespondFor(latest!.requestId, soldierId, fillText.trim())
      toast({ severity: 'success', message: 'הסטטוס נשמר' })
      setFillFor(null)
      setFillText('')
      await load()
    } catch (e) {
      toast({ severity: 'error', message: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  if (error && latest === undefined) return <ErrorState message={error} onRetry={load} />
  if (latest === undefined) return <Loading />

  const rows = latest ? [...latest.rows].sort((a, b) => Number(!!a.responded_at) - Number(!!b.responded_at)) : []
  const responded = rows.filter((r) => r.responded_at).length
  const visible = pendingOnly ? rows.filter((r) => !r.responded_at) : rows

  return (
    <Card sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography variant="h3" component="h2">
          ירוק בעיניים
        </Typography>
        {!composing && (
          <Button variant="contained" startIcon={<CampaignIcon />} onClick={() => setComposing(true)} disabled={!subordinates}>
            שלח דיווח ירוק בעיניים
          </Button>
        )}
      </Stack>

      {composing && (
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          <TextField size="small" label="הודעה לנמענים (רשות)" value={message} onChange={(e) => setMessage(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />
          <Alert
            severity="warning"
            action={
              <Stack direction="row" spacing={1}>
                <Button color="inherit" onClick={() => setComposing(false)}>
                  ביטול
                </Button>
                <Button variant="contained" color="warning" onClick={send} disabled={busy}>
                  {busy ? 'שולח…' : 'שליחה'}
                </Button>
              </Stack>
            }
          >
            לשלוח ל-{subordinates} הכפופים לך?
          </Alert>
        </Stack>
      )}

      {!latest ? (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          עדיין לא נשלחה בקשת ירוק בעיניים.
        </Typography>
      ) : (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              בקשה אחרונה ({latest.from}) · {fmtDateTime(latest.created_at)}
              {latest.message && ` · ${latest.message}`}
            </Typography>
            {latest.is_open ? <Pill tone="success" label="פתוחה" /> : <Pill icon={<LockIcon />} label="סגורה" />}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1 }}>
            <LinearProgress
              variant="determinate"
              value={rows.length ? (responded / rows.length) * 100 : 0}
              sx={{ flex: 1, height: 8, borderRadius: 99, bgcolor: tokens.dangerSoft, '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } }}
              aria-label={`${responded} מתוך ${rows.length} השיבו`}
            />
            <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
              {responded}/{rows.length} השיבו
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} role="toolbar" aria-label="סינון לפי מענה">
            {[
              { pending: false, label: `הכל (${rows.length})` },
              { pending: true, label: `טרם הזינו (${rows.length - responded})` },
            ].map((f) => (
              <Chip
                key={f.label}
                label={f.label}
                onClick={() => setPendingOnly(f.pending)}
                color={pendingOnly === f.pending ? 'primary' : 'default'}
                variant={pendingOnly === f.pending ? 'filled' : 'outlined'}
                aria-pressed={pendingOnly === f.pending}
                sx={{ height: 32 }}
              />
            ))}
          </Stack>
          {visible.length === 0 && (
            <Typography color="text.secondary" sx={{ mt: 1.5 }}>
              כולם הזינו סטטוס 🎉
            </Typography>
          )}
          <Stack divider={<Divider />} sx={{ mt: 1 }}>
            {visible.map((r) => (
              <Box key={r.recipient.id} sx={{ py: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {r.recipient.rank} {r.recipient.full_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.responded_at
                        ? `${r.location_text ?? ''} · ${fmtDateTime(r.updated_at ?? r.responded_at)}${r.responded_by ? ` · מולא ע״י ${r.responded_by.full_name}` : ''}`
                        : r.recipient.unit_name}
                    </Typography>
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                    {!r.responded_at && latest.is_open && fillFor !== r.recipient.id && (
                      <Button
                        size="small"
                        startIcon={<EditLocationAltIcon />}
                        onClick={() => {
                          setFillFor(r.recipient.id)
                          setFillText('')
                        }}
                        aria-label={`מילוי סטטוס עבור ${r.recipient.full_name}`}
                      >
                        מילוי
                      </Button>
                    )}
                    {r.responded_at ? (
                      <Pill tone="success" icon={<CheckCircleIcon />} label="השיב" />
                    ) : (
                      <Pill tone="danger" icon={<HourglassTopIcon />} label="ממתין" />
                    )}
                  </Stack>
                </Stack>
                {fillFor === r.recipient.id && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                    <TextField
                      size="small"
                      autoFocus
                      fullWidth
                      label={`היכן ${r.recipient.full_name}?`}
                      value={fillText}
                      onChange={(e) => setFillText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fillText.trim() && fill(r.recipient.id)}
                      slotProps={{ htmlInput: { maxLength: 300 } }}
                    />
                    <Button variant="contained" onClick={() => fill(r.recipient.id)} disabled={busy || !fillText.trim()}>
                      שמירה
                    </Button>
                    <Button color="inherit" onClick={() => setFillFor(null)}>
                      ביטול
                    </Button>
                  </Stack>
                )}
              </Box>
            ))}
          </Stack>
          {latest.issuedId && latest.is_open && (
            <Button color="error" size="small" startIcon={<LockIcon />} onClick={close} sx={{ mt: 1 }}>
              סגירת הבקשה
            </Button>
          )}
        </>
      )}
    </Card>
  )
}
