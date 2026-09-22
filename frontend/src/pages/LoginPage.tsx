import LoginIcon from '@mui/icons-material/Login'
import ScienceIcon from '@mui/icons-material/Science'
import { Alert, Box, Button, ButtonBase, Card, Stack, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api/client'
import type { AuthConfig, DemoUser } from '../api/types'
import { useAuth } from '../auth'
import { Loading, Pill, PersonAvatar } from '../components/common'
import { tokens } from '../theme'

export default function LoginPage() {
  const { loginDemo } = useAuth()
  const [config, setConfig] = useState<AuthConfig | null>(null)
  const [users, setUsers] = useState<DemoUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    api
      .authConfig()
      .then(async (c) => {
        setConfig(c)
        if (c.dev_login_enabled) setUsers(await api.demoUsers())
      })
      .catch((e) => setError(errorMessage(e)))
  }, [])

  const sso = async () => {
    try {
      await api.authConfig()
      window.location.href = '/api/auth/sso/login'
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const login = async (pn: string) => {
    setBusy(pn)
    setError(null)
    try {
      await loginDemo(pn)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
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

      <Box sx={{ maxWidth: 720, mx: 'auto', px: 2, mt: -6, pb: 6 }}>
        <Card sx={{ p: 3, boxShadow: tokens.liftShadow }}>
          <Stack spacing={2}>
            <Typography variant="h3" component="h2">
              כניסה למערכת
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              variant="contained"
              size="large"
              startIcon={<LoginIcon />}
              onClick={sso}
              disabled={!config?.sso_configured}
              aria-describedby="sso-help"
            >
              כניסה בהזדהות אחודה (SSO)
            </Button>
            {config && !config.sso_configured && (
              <Typography id="sso-help" variant="body2" color="text.secondary">
                ספק ההזדהות האחודה טרם הוגדר בסביבה זו. ראו README להגדרה.
              </Typography>
            )}
          </Stack>
        </Card>

        {!config && !error && <Loading />}

        {config?.dev_login_enabled && (
          <Card sx={{ p: 3, mt: 2, border: `2px dashed ${tokens.warning}` }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <ScienceIcon sx={{ color: tokens.warning }} />
              <Typography variant="h4" component="h2">
                כניסת הדגמה – סביבת פיתוח בלבד
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              משתמשים בדיוניים לצורך הדגמה. אפשרות זו מושבתת אוטומטית מחוץ לסביבת פיתוח.
            </Typography>
            {!users ? (
              <Loading />
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                {users.map((u) => (
                  <ButtonBase
                    key={u.personal_number}
                    onClick={() => login(u.personal_number)}
                    disabled={!!busy}
                    aria-label={`כניסה בתור ${u.full_name}`}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'start',
                      gap: 1.5,
                      p: 1.25,
                      borderRadius: 3,
                      border: '1px solid #e2e8f0',
                      bgcolor: busy === u.personal_number ? tokens.primarySoft : '#fff',
                      '&:hover': { borderColor: tokens.primary },
                      '&.Mui-focusVisible': { outline: `3px solid ${tokens.primary}` },
                    }}
                  >
                    <PersonAvatar name={u.full_name} size={40} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 700 }}>
                        {u.rank} {u.full_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {u.role_title} · {u.unit_name}
                      </Typography>
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                        <Pill label="חייל" />
                        {u.capabilities.commander && <Pill tone="primary" label="מפקד" />}
                        {u.capabilities.hr && <Pill tone="success" label="שלישות" />}
                      </Stack>
                    </Box>
                  </ButtonBase>
                ))}
              </Box>
            )}
          </Card>
        )}
      </Box>
    </Box>
  )
}
