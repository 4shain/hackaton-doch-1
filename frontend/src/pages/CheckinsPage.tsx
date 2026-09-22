import CampaignIcon from '@mui/icons-material/Campaign'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import LockIcon from '@mui/icons-material/Lock'
import ReplayIcon from '@mui/icons-material/Replay'
import VisibilityIcon from '@mui/icons-material/Visibility'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Card,
  Collapse,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { CheckinDetail, CheckinResponseRow, CheckinSummary, ReceivedCheckin } from '../api/types'
import { useToast, useUnread } from '../components/AppShell'
import { Empty, ErrorState, Loading, Pill, SectionTitle } from '../components/common'
import { AppDialog } from '../components/dialogs'
import { fmtDateTime } from '../lib/i18n'
import { tokens } from '../theme'

function ResponsesTable({ rows }: { rows: CheckinResponseRow[] }) {
  if (rows.length === 0) return <Empty title="אין נמענים" />
  return (
    <TableContainer>
      <Table size="small" aria-label="תשובות הנמענים">
        <TableHead>
          <TableRow>
            <TableCell>חייל</TableCell>
            <TableCell>מצב</TableCell>
            <TableCell>מיקום</TableCell>
            <TableCell>זמן תשובה</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.recipient.id}>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {r.recipient.rank} {r.recipient.full_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {r.recipient.unit_name}
                </Typography>
              </TableCell>
              <TableCell>
                {r.responded_at ? (
                  <Pill tone="success" icon={<CheckCircleIcon />} label="השיב" />
                ) : (
                  <Pill tone="danger" icon={<HourglassTopIcon />} label="ממתין" />
                )}
              </TableCell>
              <TableCell>{r.location_text ?? '—'}</TableCell>
              <TableCell>
                {fmtDateTime(r.responded_at) || '—'}
                {r.updated_at && r.updated_at !== r.responded_at && (
                  <Typography variant="caption" color="text.secondary" component="div">
                    עודכן {fmtDateTime(r.updated_at)}
                  </Typography>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function RequestDetailDialog({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast()
  const [detail, setDetail] = useState<CheckinDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (id == null) return
    api.checkinDetail(id).then(setDetail, (e) => setError(errorMessage(e)))
  }, [id])
  useEffect(() => {
    setDetail(null)
    setError(null)
    load()
    if (id == null) return
    const t = window.setInterval(load, 15000)
    return () => window.clearInterval(t)
  }, [id, load])

  const close = async () => {
    try {
      setDetail(await api.checkinClose(id!))
      toast({ severity: 'success', message: 'הבקשה נסגרה' })
      onChanged()
    } catch (e) {
      toast({ severity: 'error', message: errorMessage(e) })
    }
  }

  return (
    <AppDialog
      open={id != null}
      onClose={onClose}
      title="תמונת מצב – ירוק בעיניים"
      maxWidth="md"
      actions={
        detail?.is_open && (
          <Button color="error" variant="outlined" startIcon={<LockIcon />} onClick={close}>
            סגירת הבקשה
          </Button>
        )
      }
    >
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !detail ? (
        <Loading />
      ) : (
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              נשלחה {fmtDateTime(detail.created_at)}
              {detail.closed_at && ` · נסגרה ${fmtDateTime(detail.closed_at)}`}
            </Typography>
            {detail.message && <Typography sx={{ mt: 0.5 }}>{detail.message}</Typography>}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {[
              { label: 'נמענים', value: detail.total, color: tokens.primary },
              { label: 'השיבו', value: detail.responded, color: tokens.success },
              { label: 'ממתינים', value: detail.pending, color: tokens.danger },
            ].map((m) => (
              <Box key={m.label} sx={{ p: 1.5, borderRadius: 3, bgcolor: tokens.surfaceLow, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 28, fontWeight: 800, color: m.color }}>{m.value}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {m.label}
                </Typography>
              </Box>
            ))}
          </Box>
          <ResponsesTable rows={detail.responses} />
        </Stack>
      )}
    </AppDialog>
  )
}

/** A request I received from my commander: my own subordinates' answers + re-send down the chain. */
function ReceivedCard({
  item,
  highlight,
  onResent,
  onOpenResend,
}: {
  item: ReceivedCheckin
  highlight: boolean
  onResent: (id: number) => void
  onOpenResend: (id: number) => void
}) {
  const toast = useToast()
  const [showTable, setShowTable] = useState(highlight)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const open = item.request.is_open

  useEffect(() => {
    if (highlight) document.getElementById(`received-${item.request.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [highlight, item.request.id])

  const resend = async () => {
    setBusy(true)
    try {
      const d = await api.checkinCreate(item.request.message ?? undefined, item.request.id)
      toast({ severity: 'success', message: `שליחה חוזרת נשלחה ל-${d.total} הכפופים לך` })
      setConfirm(false)
      onResent(d.id)
    } catch (e) {
      toast({ severity: 'error', message: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card id={`received-${item.request.id}`} sx={{ p: 2, outline: highlight ? `2px solid ${tokens.primary}` : 'none' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h3">
            בקשה מאת {item.request.commander.full_name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            נשלחה {fmtDateTime(item.request.created_at)}
            {item.request.message && ` · ${item.request.message}`}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            התשובה שלי: {item.my_response.location_text ?? 'טרם השבתי'}
          </Typography>
        </Box>
        {open ? <Pill tone="success" label="פתוחה" /> : <Pill icon={<LockIcon />} label="סגורה" />}
      </Stack>

      <Typography variant="h6" sx={{ mt: 1.5 }}>
        סטטוס הכפופים לי
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 0.75 }}>
        <LinearProgress
          variant="determinate"
          value={item.total ? (item.responded / item.total) * 100 : 0}
          sx={{ flex: 1, height: 8, borderRadius: 99, bgcolor: tokens.dangerSoft, '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } }}
          aria-label={`${item.responded} מתוך ${item.total} מהכפופים לי השיבו`}
        />
        <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
          {item.responded}/{item.total} השיבו · {item.pending} ממתינים
        </Typography>
      </Stack>

      {item.resends.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 1.25 }}>
          {item.resends.map((r) => (
            <ButtonBase
              key={r.id}
              onClick={() => onOpenResend(r.id)}
              sx={{ justifyContent: 'space-between', p: 1, borderRadius: 2, bgcolor: tokens.surfaceLow, gap: 1 }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center">
                <ReplayIcon sx={{ fontSize: 18, color: tokens.primary }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  שליחה חוזרת שלי · {fmtDateTime(r.created_at)}
                </Typography>
              </Stack>
              <Typography variant="body2">
                {r.responded}/{r.total} השיבו
              </Typography>
            </ButtonBase>
          ))}
        </Stack>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" size="small" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'הסתרת פירוט' : 'פירוט הכפופים'}
        </Button>
        {open && item.total > 0 && !confirm && (
          <Button variant="contained" size="small" startIcon={<ReplayIcon />} onClick={() => setConfirm(true)}>
            שליחה חוזרת לכפופים
          </Button>
        )}
      </Stack>
      {confirm && (
        <Alert
          severity="warning"
          sx={{ mt: 1.5 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button color="inherit" onClick={() => setConfirm(false)}>
                ביטול
              </Button>
              <Button variant="contained" color="warning" onClick={resend} disabled={busy}>
                {busy ? 'שולח…' : 'שליחה'}
              </Button>
            </Stack>
          }
        >
          לשלוח ירוק בעיניים חוזר ל-{item.total} הכפופים לך? מי שטרם השיב יועבר שוב למסך המענה, ותשובה אחת מעדכנת את שתי הבקשות.
        </Alert>
      )}
      <Collapse in={showTable} unmountOnExit>
        <Box sx={{ mt: 1.5 }}>
          <ResponsesTable rows={item.responses} />
        </Box>
      </Collapse>
    </Card>
  )
}

export default function CheckinsPage() {
  const toast = useToast()
  const { refresh: refreshUnread } = useUnread()
  const [params, setParams] = useSearchParams()
  const focusId = Number(params.get('request')) || null
  const fromId = Number(params.get('from')) || null
  const [received, setReceived] = useState<ReceivedCheckin[] | null>(null)
  const [issued, setIssued] = useState<{ subordinate_count: number; requests: CheckinSummary[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [sending, setSending] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)

  const load = useCallback(() => {
    setError(null)
    api.checkinsIssued().then(setIssued, (e) => setError(errorMessage(e)))
    api.checkinsReceived().then(setReceived, (e) => setError(errorMessage(e)))
    refreshUnread()
  }, [refreshUnread])
  useEffect(() => {
    load()
    const t = window.setInterval(load, 20000)
    return () => window.clearInterval(t)
  }, [load])

  // Deep link from a notification: open the matching request.
  useEffect(() => {
    if (!focusId) return
    if (issued?.requests.some((r) => r.id === focusId)) setDetailId(focusId)
  }, [focusId, issued])

  const create = async () => {
    setSending(true)
    try {
      const d = await api.checkinCreate(message.trim())
      toast({ severity: 'success', message: `הבקשה נשלחה ל-${d.total} חיילים` })
      setMessage('')
      setConfirm(false)
      load()
      setDetailId(d.id)
    } catch (e) {
      toast({ severity: 'error', message: errorMessage(e) })
    } finally {
      setSending(false)
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!issued || !received) return <Loading />

  return (
    <Stack spacing={2} sx={{ maxWidth: 960, mx: 'auto' }}>
      <Box sx={{ p: 2.5, borderRadius: 4, background: 'linear-gradient(135deg, #007550 0%, #005a3c 100%)', color: '#fff' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <VisibilityIcon sx={{ fontSize: 34 }} />
          <Box>
            <Typography component="h2" sx={{ fontSize: 22, fontWeight: 700 }}>
              ירוק בעיניים
            </Typography>
            <Typography sx={{ opacity: 0.9, fontSize: 14 }}>
              בדיקת מיקום מהירה של כל הכפופים. החיילים יועברו למסך מענה חובה עד שישיבו. אינה משנה את דיווח הנוכחות היומי.
            </Typography>
          </Box>
        </Stack>
      </Box>

      {received.length > 0 && (
        <>
          <SectionTitle>בקשות מהמפקד שלי</SectionTitle>
          {received.map((r) => (
            <ReceivedCard
              key={r.request.id}
              item={r}
              highlight={fromId === r.request.id}
              onResent={(id) => {
                load()
                setDetailId(id)
              }}
              onOpenResend={setDetailId}
            />
          ))}
        </>
      )}

      <>
          <SectionTitle>בקשות שלי כמפקד</SectionTitle>
          <Card sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Typography>
                הבקשה תישלח לכל <b>{issued.subordinate_count}</b> הכפופים לך (ישירים ועקיפים). רשימת הנמענים נקבעת ברגע השליחה.
              </Typography>
              <TextField label="הודעה לנמענים (רשות)" value={message} onChange={(e) => setMessage(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />
              {confirm ? (
                <Alert
                  severity="warning"
                  action={
                    <Stack direction="row" spacing={1}>
                      <Button color="inherit" onClick={() => setConfirm(false)}>
                        ביטול
                      </Button>
                      <Button variant="contained" color="warning" onClick={create} disabled={sending}>
                        {sending ? 'שולח…' : 'אישור ושליחה'}
                      </Button>
                    </Stack>
                  }
                >
                  לשלוח בקשה ל-{issued?.subordinate_count} חיילים?
                </Alert>
              ) : (
                <Button variant="contained" size="large" startIcon={<CampaignIcon />} onClick={() => setConfirm(true)} disabled={!issued?.subordinate_count}>
                  שליחת בקשת ירוק בעיניים
                </Button>
              )}
            </Stack>
          </Card>

          {!issued ? (
            <Loading />
          ) : issued.requests.length === 0 ? (
            <Card>
              <Empty title="עדיין לא שלחת בקשות" />
            </Card>
          ) : (
            <Stack spacing={1.25}>
              {issued.requests.map((r) => (
                <ButtonBase
                  key={r.id}
                  onClick={() => setDetailId(r.id)}
                  sx={{ display: 'block', textAlign: 'start', borderRadius: 4, '&.Mui-focusVisible': { outline: `3px solid ${tokens.primary}` } }}
                >
                  <Card sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>{fmtDateTime(r.created_at)}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {r.message ?? 'ללא הודעה'}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        {r.parent_request_id && <Pill tone="primary" icon={<ReplayIcon />} label="שליחה חוזרת" />}
                        {r.is_open ? <Pill tone="success" label="פתוחה" /> : <Pill icon={<LockIcon />} label="סגורה" />}
                      </Stack>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1.25 }}>
                      <LinearProgress
                        variant="determinate"
                        value={r.total ? (r.responded / r.total) * 100 : 0}
                        sx={{ flex: 1, height: 8, borderRadius: 99, bgcolor: tokens.dangerSoft, '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } }}
                        aria-label={`${r.responded} מתוך ${r.total} השיבו`}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {r.responded}/{r.total} השיבו · {r.pending} ממתינים
                      </Typography>
                    </Stack>
                  </Card>
                </ButtonBase>
              ))}
            </Stack>
          )}
        </>

      <RequestDetailDialog
        id={detailId}
        onClose={() => {
          setDetailId(null)
          if (focusId) setParams(fromId ? { from: String(fromId) } : {}, { replace: true })
        }}
        onChanged={load}
      />
    </Stack>
  )
}
