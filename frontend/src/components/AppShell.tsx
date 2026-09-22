import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter'
import GroupsIcon from '@mui/icons-material/Groups'
import LogoutIcon from '@mui/icons-material/Logout'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import VisibilityIcon from '@mui/icons-material/Visibility'
import {
  Alert,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  ButtonBase,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../auth'
import { tokens } from '../theme'
import { NotificationsMenu } from './NotificationsMenu'

// ------------------------------------------------------------------ toasts

type Toast = { message: string; severity: 'success' | 'error' | 'info' | 'warning' }
const ToastContext = createContext<(t: Toast) => void>(() => {})
export const useToast = () => useContext(ToastContext)

// ------------------------------------------------------------------ unread notifications (polling)

const UnreadContext = createContext<{ refresh: () => void }>({ refresh: () => {} })
export const useUnread = () => useContext(UnreadContext)

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  badge?: number
}

const navLabel = (i: NavItem) => (i.badge ? `${i.label}, ${i.badge} חדשות` : i.label)

export function AppShell({ children }: { children: ReactNode }) {
  const { me, logout } = useSession()
  const theme = useTheme()
  const desktop = useMediaQuery(theme.breakpoints.up('md'))
  const nav = useNavigate()
  const loc = useLocation()
  const [toast, setToast] = useState<Toast | null>(null)
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null)

  const [menuKey, setMenuKey] = useState(0)
  // Remount the bell so its unread count refreshes after actions that create/clear notifications.
  const refresh = useCallback(() => setMenuKey((k) => k + 1), [])
  useEffect(refresh, [refresh, loc.pathname])

  const items: NavItem[] = useMemo(() => {
    const list: NavItem[] = [
      { to: '/', label: 'הדיווח שלי', icon: <AssignmentTurnedInIcon /> },
      { to: '/history', label: 'היסטוריה', icon: <CalendarMonthIcon /> },
    ]
    if (me.capabilities.commander) list.push({ to: '/soldiers', label: 'החיילים שלי', icon: <GroupsIcon /> })
    if (me.capabilities.commander) list.push({ to: '/checkins', label: 'ירוק בעיניים', icon: <VisibilityIcon /> })
    if (me.capabilities.hr) list.push({ to: '/hr', label: 'ניהול שלישות', icon: <BusinessCenterIcon /> })
    return list
  }, [me])

  const current = items.find((i) => (i.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(i.to))) ?? items[0]
  const roles = [me.capabilities.commander && 'מפקד', me.capabilities.hr && 'שלישות'].filter(Boolean).join(' + ') || 'חייל'

  return (
    <ToastContext.Provider value={setToast}>
      <UnreadContext.Provider value={{ refresh }}>
        <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
          <Box
            component="header"
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 1100,
              background: tokens.headerGradient,
              color: '#fff',
              boxShadow: '0 2px 12px rgba(0,82,255,0.22)',
              pt: 'env(safe-area-inset-top)',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ height: 72, px: { xs: 2, md: 4 }, maxWidth: 1440, mx: 'auto' }}>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
                <Box
                  component="img"
                  src="/logo-192.png"
                  alt="לוגו דו״ח 1"
                  sx={{ width: 42, height: 42, borderRadius: 2.5, border: '2px solid rgba(255,255,255,.3)', flexShrink: 0 }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Typography component="h1" sx={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {desktop ? 'דו״ח 1' : current.label}
                    </Typography>
                    <Box
                      component="span"
                      sx={{ fontSize: 10, fontWeight: 600, px: 0.75, py: 0.25, borderRadius: 99, bgcolor: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.2)' }}
                    >
                      בלמ״ס
                    </Box>
                  </Stack>
                  <Typography sx={{ fontSize: 12, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {me.unit.name} | {me.rank} {me.full_name} · {roles}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <NotificationsMenu key={menuKey} />
                <IconButton aria-label="תפריט משתמש" onClick={(e) => setMenuEl(e.currentTarget)} sx={{ color: '#fff' }}>
                  <LogoutIcon />
                </IconButton>
                <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
                  <Box sx={{ px: 2, py: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{me.full_name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      מ.א <bdi>{me.personal_number}</bdi> · {me.role_title}
                    </Typography>
                  </Box>
                  <Divider />
                  <MenuItem
                    onClick={() => {
                      setMenuEl(null)
                      logout().then(() => nav('/'))
                    }}
                  >
                    <ListItemIcon>
                      <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    יציאה
                  </MenuItem>
                </Menu>
              </Stack>
            </Stack>
          </Box>

          <Box sx={{ display: 'flex', maxWidth: 1440, mx: 'auto' }}>
            {desktop && (
              <Box component="nav" aria-label="ניווט ראשי" sx={{ width: 240, flexShrink: 0, p: 2, position: 'sticky', top: 72, alignSelf: 'flex-start' }}>
                <Stack spacing={0.5}>
                  {items.map((i) => {
                    const active = i === current
                    return (
                      <ButtonBase
                        key={i.to}
                        onClick={() => nav(i.to)}
                        aria-current={active ? 'page' : undefined}
                        aria-label={navLabel(i)}
                        sx={{
                          justifyContent: 'flex-start',
                          gap: 1.5,
                          px: 2,
                          py: 1.5,
                          borderRadius: 2,
                          fontWeight: 600,
                          fontSize: 15,
                          color: active ? tokens.primary : 'text.primary',
                          bgcolor: active ? tokens.primarySoft : 'transparent',
                          '&:hover': { bgcolor: active ? tokens.primarySoft : tokens.surfaceContainer },
                          '&.Mui-focusVisible': { outline: `3px solid ${tokens.primary}` },
                        }}
                      >
                        <Badge badgeContent={i.badge} color="error">
                          {i.icon}
                        </Badge>
                        {i.label}
                      </ButtonBase>
                    )
                  })}
                </Stack>
              </Box>
            )}
            <Box component="main" sx={{ flex: 1, minWidth: 0, px: { xs: 2, md: 3 }, pt: 2, pb: { xs: 14, md: 6 } }}>
              {children}
            </Box>
          </Box>

          {!desktop && (
            <Paper
              component="nav"
              aria-label="ניווט ראשי"
              elevation={0}
              sx={{ position: 'fixed', bottom: 0, insetInline: 0, zIndex: 1100, borderTop: '1px solid #e2e8f0', pb: 'env(safe-area-inset-bottom)', borderRadius: 0 }}
            >
              <BottomNavigation showLabels value={current.to} onChange={(_, v) => nav(v)} sx={{ height: 68 }}>
                {items.map((i) => (
                  <BottomNavigationAction
                    key={i.to}
                    value={i.to}
                    label={i.label}
                    aria-label={navLabel(i)}
                    icon={
                      <Badge badgeContent={i.badge} color="error">
                        {i.icon}
                      </Badge>
                    }
                    sx={{ minWidth: 0, px: 0.5, '& .MuiBottomNavigationAction-label': { fontSize: 11, fontWeight: 600, mt: 0.25 } }}
                  />
                ))}
              </BottomNavigation>
            </Paper>
          )}

          <Snackbar
            open={!!toast}
            autoHideDuration={4000}
            onClose={() => setToast(null)}
            anchorOrigin={{ vertical: desktop ? 'bottom' : 'top', horizontal: 'center' }}
          >
            {toast ? (
              <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)} sx={{ width: '100%' }}>
                {toast.message}
              </Alert>
            ) : undefined}
          </Snackbar>
        </Box>
      </UnreadContext.Provider>
    </ToastContext.Provider>
  )
}
