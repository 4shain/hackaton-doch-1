import LogoutIcon from '@mui/icons-material/Logout'
import PlaceIcon from '@mui/icons-material/Place'
import SendIcon from '@mui/icons-material/Send'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { Alert, Box, Button, Card, Stack, TextField, Typography } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { IncomingCheckin } from '../api/types'
import { useSession } from '../auth'
import { fmtDateTime } from '../lib/i18n'

const GREEN = 'linear-gradient(160deg, #007550 0%, #005a3c 100%)'

/**
 * Blocking page shown whenever the user has an open ירוק בעיניים request they have not answered.
 * The rest of the app is unavailable until every pending request is answered (or closed by the commander).
 */
export default function CheckinRequiredPage({ pending, onAnswered }: { pending: IncomingCheckin[]; onAnswered: () => Promise<void> }) {
  const { me, logout } = useSession()
  const nav = useNavigate()
  const item = pending[0]
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Separate page: reflect it in the URL while the gate is active. Mount-only on purpose:
  // `nav` changes identity on every location change, which would undo the post-answer redirect.
  useEffect(() => {
    nav('/checkin', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setText('')
    setError(null)
    inputRef.current?.focus()
  }, [item.request.id])

  const submit = async () => {
    if (!text.trim()) {
      setError('יש לכתוב את מיקומך הנוכחי.')
      inputRef.current?.focus()
      return
    }
    setBusy(true)
    setError(null)
    try {
      // "Where are you now?" has one answer: send it to every open request at once.
      for (const p of pending) await api.checkinRespond(p.request.id, text.trim())
      // Commanders continue to the status of their own subordinates for this request.
      if (me.capabilities.commander) nav(`/checkins?from=${item.request.id}`, { replace: true })
      await onAnswered()
    } catch (e) {
      setError(errorMessage(e))
      // The request may have been closed meanwhile; refresh the list either way.
      await onAnswered()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box
      component="main"
      sx={{ minHeight: '100dvh', background: GREEN, color: '#fff', display: 'flex', flexDirection: 'column', pt: 'env(safe-area-inset-top)' }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box component="img" src="/logo-192.png" alt="" sx={{ width: 36, height: 36, borderRadius: 2 }} />
          <Typography sx={{ fontWeight: 700 }}>דו״ח 1</Typography>
        </Stack>
        <Button color="inherit" size="small" startIcon={<LogoutIcon />} onClick={() => logout().then(() => nav('/', { replace: true }))}>
          יציאה
        </Button>
      </Stack>

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, pb: 4 }}>
        <Box sx={{ width: '100%', maxWidth: 520 }}>
          <Stack alignItems="center" spacing={1} sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,.15)',
                display: 'grid',
                placeItems: 'center',
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%': { boxShadow: '0 0 0 0 rgba(114,254,192,.6)' },
                  '70%': { boxShadow: '0 0 0 22px rgba(114,254,192,0)' },
                  '100%': { boxShadow: '0 0 0 0 rgba(114,254,192,0)' },
                },
              }}
            >
              <VisibilityIcon sx={{ fontSize: 44 }} />
            </Box>
            <Typography component="h1" sx={{ fontSize: 30, fontWeight: 800 }}>
              ירוק בעיניים
            </Typography>
            <Typography sx={{ opacity: 0.9 }}>
              {[...new Set(pending.map((p) => p.request.commander.full_name))].join(', ')} מבקש/ים לדעת היכן את/ה נמצא/ת כעת.
              <br />
              יש להשיב כדי להמשיך להשתמש במערכת.
            </Typography>
            {pending.length > 1 && (
              <Typography sx={{ fontSize: 13, fontWeight: 600, bgcolor: 'rgba(255,255,255,.15)', px: 1.5, py: 0.5, borderRadius: 99 }}>
                תשובה אחת תישלח ל-{pending.length} בקשות פתוחות
              </Typography>
            )}
            {me.capabilities.commander && (
              <Typography sx={{ fontSize: 13, opacity: 0.9 }}>לאחר המענה תועבר/י לתמונת המצב של הכפופים לך.</Typography>
            )}
          </Stack>

          <Card sx={{ p: 2.5, color: 'text.primary' }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  נשלחה ע״י {item.request.commander.full_name} · {fmtDateTime(item.request.created_at)}
                </Typography>
                {item.request.message && (
                  <Typography sx={{ mt: 1, p: 1.25, bgcolor: '#ecfdf5', borderRadius: 2, fontWeight: 500 }}>{item.request.message}</Typography>
                )}
              </Box>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                inputRef={inputRef}
                label={`${me.full_name}, היכן אתה נמצא כעת?`}
                placeholder="לדוגמה: בבית בחיפה / בבסיס / בדרך ליחידה"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                required
                error={!!error}
                slotProps={{
                  htmlInput: { maxLength: 300 },
                  input: { startAdornment: <PlaceIcon sx={{ color: 'text.secondary', mr: 1 }} /> },
                }}
              />
              <Button
                variant="contained"
                size="large"
                startIcon={<SendIcon />}
                onClick={submit}
                disabled={busy}
                sx={{ bgcolor: '#007550', '&:hover': { bgcolor: '#005a3c' }, fontSize: 17 }}
              >
                {busy ? 'שולח…' : 'שליחת מיקום למפקד'}
              </Button>
            </Stack>
          </Card>
        </Box>
      </Box>
    </Box>
  )
}
