import AlarmIcon from '@mui/icons-material/Alarm'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import NotificationsIcon from '@mui/icons-material/Notifications'
import PendingActionsIcon from '@mui/icons-material/PendingActions'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { Badge, Box, Button, ButtonBase, Divider, IconButton, Popover, Stack, Typography } from '@mui/material'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { AppNotification } from '../api/types'
import { fmtDateTime } from '../lib/i18n'
import { tokens } from '../theme'
import { Empty, ErrorState, Loading } from './common'

const ICON: Record<string, ReactNode> = {
  checkin_request: <VisibilityIcon />,
  checkin_response: <VisibilityIcon />,
  report_reminder: <AlarmIcon />,
  report_pending: <PendingActionsIcon />,
  report_approved: <CheckCircleIcon />,
}

/** Header bell with a floating notifications list (no separate page). Unread count is polled. */
export function NotificationsMenu() {
  const nav = useNavigate()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshCount = useCallback(() => {
    api.unreadCount().then((r) => setUnread(r.unread), () => {})
  }, [])
  useEffect(() => {
    refreshCount()
    const t = window.setInterval(refreshCount, 20000)
    return () => window.clearInterval(t)
  }, [refreshCount])

  const loadList = useCallback(() => {
    setError(null)
    api.notifications().then(
      (r) => {
        setItems(r.items)
        setUnread(r.unread)
      },
      (e) => setError(errorMessage(e)),
    )
  }, [])

  const openMenu = (el: HTMLElement) => {
    setAnchor(el)
    setItems(null)
    loadList()
  }

  const clickItem = async (n: AppNotification) => {
    if (!n.read) {
      await api.markRead(n.id).catch(() => {})
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null)
      setUnread((u) => Math.max(0, u - 1))
    }
    if (n.link) {
      setAnchor(null)
      nav(n.link)
    }
  }

  const readAll = async () => {
    await api.markAllRead()
    setItems((prev) => prev?.map((x) => ({ ...x, read: true })) ?? null)
    setUnread(0)
  }

  return (
    <>
      <IconButton
        aria-label={`התראות, ${unread} שלא נקראו`}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        onClick={(e) => openMenu(e.currentTarget)}
        sx={{ color: '#fff' }}
      >
        <Badge badgeContent={unread} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': 'התראות',
            sx: { width: 380, maxWidth: 'calc(100vw - 16px)', maxHeight: 'min(560px, calc(100dvh - 96px))', display: 'flex', flexDirection: 'column', mt: 1, borderRadius: 3, boxShadow: tokens.liftShadow },
          },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.25 }}>
          <Typography variant="h4" component="h2">
            התראות {unread > 0 && `(${unread})`}
          </Typography>
          {unread > 0 && (
            <Button size="small" startIcon={<DoneAllIcon />} onClick={readAll} sx={{ minHeight: 32 }}>
              סימון הכל כנקרא
            </Button>
          )}
        </Stack>
        <Divider />
        <Box sx={{ overflowY: 'auto' }}>
          {error ? (
            <Box sx={{ p: 2 }}>
              <ErrorState message={error} onRetry={loadList} />
            </Box>
          ) : !items ? (
            <Loading />
          ) : items.length === 0 ? (
            <Empty title="אין התראות" icon={<NotificationsIcon />} />
          ) : (
            <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {items.map((n, i) => (
                <li key={n.id}>
                  <ButtonBase
                    onClick={() => clickItem(n)}
                    sx={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      textAlign: 'start',
                      gap: 1.25,
                      px: 2,
                      py: 1.25,
                      borderTop: i ? '1px solid #eef1f6' : 'none',
                      bgcolor: n.read ? '#fff' : tokens.surfaceLow,
                      '&:hover': { bgcolor: tokens.surfaceContainer },
                    }}
                  >
                    <Box sx={{ color: n.read ? 'text.secondary' : tokens.primary, display: 'flex', mt: 0.25, alignSelf: 'flex-start' }}>
                      {ICON[n.kind] ?? <NotificationsIcon />}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: n.read ? 400 : 700, fontSize: 14 }}>{n.title}</Typography>
                      {n.body && (
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {n.body}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {fmtDateTime(n.created_at)}
                      </Typography>
                    </Box>
                    {!n.read && <Box aria-label="לא נקראה" sx={{ width: 8, height: 8, borderRadius: 99, bgcolor: tokens.primary, flexShrink: 0 }} />}
                  </ButtonBase>
                </li>
              ))}
            </Box>
          )}
        </Box>
      </Popover>
    </>
  )
}
