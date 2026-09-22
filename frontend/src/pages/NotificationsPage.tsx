import AlarmIcon from '@mui/icons-material/Alarm'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import NotificationsIcon from '@mui/icons-material/Notifications'
import PendingActionsIcon from '@mui/icons-material/PendingActions'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { Box, Button, ButtonBase, Card, Stack, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { AppNotification } from '../api/types'
import { useUnread } from '../components/AppShell'
import { Empty, ErrorState, Loading, SectionTitle } from '../components/common'
import { fmtDateTime } from '../lib/i18n'
import { tokens } from '../theme'

const ICON: Record<string, React.ReactNode> = {
  checkin_request: <VisibilityIcon />,
  checkin_response: <VisibilityIcon />,
  report_reminder: <AlarmIcon />,
  report_pending: <PendingActionsIcon />,
  report_approved: <CheckCircleIcon />,
}

export default function NotificationsPage() {
  const nav = useNavigate()
  const { refresh } = useUnread()
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    api.notifications().then((r) => setItems(r.items), (e) => setError(errorMessage(e)))
  }, [])
  useEffect(() => {
    load()
    const t = window.setInterval(load, 20000)
    return () => window.clearInterval(t)
  }, [load])

  const open = async (n: AppNotification) => {
    if (!n.read) {
      await api.markRead(n.id).catch(() => {})
      refresh()
    }
    if (n.link) nav(n.link)
    else load()
  }

  const readAll = async () => {
    await api.markAllRead()
    refresh()
    load()
  }

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!items) return <Loading />
  const unread = items.filter((i) => !i.read).length

  return (
    <Stack spacing={2} sx={{ maxWidth: 860, mx: 'auto' }}>
      <SectionTitle
        action={
          unread > 0 && (
            <Button startIcon={<DoneAllIcon />} onClick={readAll}>
              סימון הכל כנקרא
            </Button>
          )
        }
      >
        התראות {unread > 0 && `(${unread} חדשות)`}
      </SectionTitle>
      {items.length === 0 ? (
        <Card>
          <Empty title="אין התראות" icon={<NotificationsIcon />} />
        </Card>
      ) : (
        <Card component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {items.map((n, i) => (
            <li key={n.id}>
              <ButtonBase
                onClick={() => open(n)}
                sx={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  textAlign: 'start',
                  gap: 1.5,
                  p: 2,
                  borderTop: i ? '1px solid #eef1f6' : 'none',
                  bgcolor: n.read ? '#fff' : tokens.surfaceLow,
                }}
              >
                <Box sx={{ color: n.read ? 'text.secondary' : tokens.primary, display: 'flex' }}>{ICON[n.kind] ?? <NotificationsIcon />}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: n.read ? 400 : 700 }}>{n.title}</Typography>
                  {n.body && (
                    <Typography variant="body2" color="text.secondary">
                      {n.body}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {fmtDateTime(n.created_at)}
                  </Typography>
                </Box>
                {!n.read && (
                  <Typography variant="caption" sx={{ color: tokens.primary, fontWeight: 700, flexShrink: 0 }}>
                    חדש
                  </Typography>
                )}
              </ButtonBase>
            </li>
          ))}
        </Card>
      )}
    </Stack>
  )
}
