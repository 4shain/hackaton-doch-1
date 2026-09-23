import LoginIcon from '@mui/icons-material/Login'
import { Alert, Box, Button, Card, Stack, TextField, Typography } from '@mui/material'
import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from '../api/client'
import type { AuthConfig } from '../api/types'
import { useAuth } from '../auth'
import { Loading } from '../components/common'
import { tokens } from '../theme'

export default function LoginPage() {
  const { login } = useAuth()
  const [config, setConfig] = useState<AuthConfig | null>(null)
  const [idNumber, setIdNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.authConfig().then(setConfig, (e) => setError(errorMessage(e)))
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!idNumber.trim()) return
    setBusy(true)
    setError(null)
    try {
      await login(idNumber.trim())
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Box sx={{ background: tokens.headerGradient, color: '#fff', pt: 6, pb: 10, px: 2, textAlign: 'center' }}>
        <Box component="img" src="/logo.png" alt="" sx={{ width: 104, height: 104, borderRadius: 5, boxShadow: '0 12px 30px rgba(0,0,0,.25)' }} />
        <Typography component="h1" sx={{ fontSize: 34, fontWeight: 800, mt: 2 }}>
          דו״ח 1
        </Typography>
        <Typography sx={{ opacity: 0.9 }}>דיווח נוכחות יומי, אישור מפקדים, שלישות וירוק בעיניים</Typography>
      </Box>

      <Box sx={{ maxWidth: 440, mx: 'auto', px: 2, mt: -6, pb: 6 }}>
        <Card sx={{ p: 3, boxShadow: tokens.liftShadow }}>
          <Stack component="form" spacing={2} onSubmit={submit} noValidate>
            <Typography variant="h3" component="h2">
              כניסה למערכת
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {!config && !error ? (
              <Loading />
            ) : config?.id_login_enabled === false ? (
              <Alert severity="warning">הכניסה לפי תעודת זהות מושבתת בסביבה זו.</Alert>
            ) : (
              <>
                <TextField
                  label="תעודת זהות"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  autoFocus
                  autoComplete="username"
                  slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 12, dir: 'ltr', style: { textAlign: 'right' } } }}
                />
                <Button type="submit" variant="contained" size="large" startIcon={<LoginIcon />} disabled={busy || !idNumber.trim()}>
                  {busy ? 'מתחבר…' : 'כניסה'}
                </Button>
              </>
            )}
          </Stack>
        </Card>
      </Box>
    </Box>
  )
}
