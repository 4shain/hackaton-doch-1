import AccessTimeIcon from '@mui/icons-material/AccessTime'
import ApartmentIcon from '@mui/icons-material/Apartment'
import BadgeIcon from '@mui/icons-material/Badge'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus'
import EditNoteIcon from '@mui/icons-material/EditNote'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import EventIcon from '@mui/icons-material/Event'
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff'
import HealingIcon from '@mui/icons-material/Healing'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import InboxIcon from '@mui/icons-material/Inbox'
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'
import LockIcon from '@mui/icons-material/Lock'
import PendingActionsIcon from '@mui/icons-material/PendingActions'
import SendIcon from '@mui/icons-material/Send'
import { Alert, Avatar, Box, Button, Card, Chip, CircularProgress, Stack, Typography, type SxProps } from '@mui/material'
import type { ReactNode } from 'react'
import type { Report, ReportState } from '../api/types'
import { SOURCE_LABEL, STATE_SHORT } from '../lib/i18n'
import { tokens } from '../theme'

const ICONS: Record<string, typeof ApartmentIcon> = {
  apartment: ApartmentIcon,
  badge: BadgeIcon,
  directions_bus: DirectionsBusIcon,
  bedtime: BedtimeIcon,
  flight_takeoff: FlightTakeoffIcon,
  healing: HealingIcon,
  local_hospital: LocalHospitalIcon,
  edit_note: EditNoteIcon,
}

export function ReasonIcon({ icon, sx }: { icon?: string | null; sx?: SxProps }) {
  const Icon = (icon && ICONS[icon]) || HelpOutlineIcon
  return <Icon sx={sx} aria-hidden />
}

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'

export const TONE: Record<Tone, { fg: string; bg: string }> = {
  success: { fg: tokens.success, bg: tokens.successSoft },
  warning: { fg: tokens.warning, bg: tokens.warningSoft },
  danger: { fg: tokens.danger, bg: tokens.dangerSoft },
  info: { fg: tokens.info, bg: tokens.infoSoft },
  primary: { fg: tokens.primaryDark, bg: tokens.primarySoft },
  neutral: { fg: tokens.onSurfaceVariant, bg: tokens.surfaceContainer },
}

export function Pill({ tone = 'neutral', icon, label, sx }: { tone?: Tone; icon?: ReactNode; label: ReactNode; sx?: SxProps }) {
  const c = TONE[tone]
  return (
    <Chip
      size="small"
      icon={icon as React.ReactElement | undefined}
      label={label}
      sx={{ bgcolor: c.bg, color: c.fg, borderRadius: 999, height: 26, '& .MuiChip-icon': { color: c.fg, fontSize: 16 }, ...sx }}
    />
  )
}

const STATE_TONE: Record<ReportState, Tone> = {
  scheduled: 'info',
  pending_approval: 'warning',
  approved: 'success',
  sent_to_hr: 'primary',
  hr_final: 'neutral',
}
const STATE_ICON: Record<ReportState, ReactNode> = {
  scheduled: <EventIcon />,
  pending_approval: <PendingActionsIcon />,
  approved: <CheckCircleIcon />,
  sent_to_hr: <SendIcon />,
  hr_final: <LockIcon />,
}

/** Approval/workflow state. Always icon + text, never color alone. */
export function StateChip({ state }: { state: ReportState }) {
  return <Pill tone={STATE_TONE[state]} icon={STATE_ICON[state]} label={STATE_SHORT[state]} />
}

export function MissingChip() {
  return <Pill tone="danger" icon={<ErrorOutlineIcon />} label="חסר דיווח" />
}

/** Effective attendance status (separate from approval state). */
export function StatusChip({ report }: { report: Report | null }) {
  if (!report) return <MissingChip />
  const r = report.effective.reason
  if (!r) return <MissingChip />
  return (
    <Pill
      tone={r.is_present ? 'success' : 'warning'}
      icon={<ReasonIcon icon={r.icon ?? iconFor(r.code)} />}
      label={r.label}
    />
  )
}

export const iconFor = (code: string) =>
  ({
    at_base: 'apartment',
    outside_duty: 'badge',
    on_the_way: 'directions_bus',
    after_duty: 'bedtime',
    vacation: 'flight_takeoff',
    sick: 'healing',
    medical: 'local_hospital',
    other: 'edit_note',
  })[code]

export function ProvenanceNote({ report }: { report: Report }) {
  return (
    <Typography variant="body2" color="text.secondary" component="span">
      מקור: {SOURCE_LABEL[report.effective.source]}
    </Typography>
  )
}

export function accentFor(report: Report | null) {
  if (!report || !report.effective.reason) return tokens.danger
  return report.effective.reason.is_present ? '#10b981' : '#f59e0b'
}

export function PersonAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
  return (
    <Avatar sx={{ width: size, height: size, bgcolor: tokens.primarySoft, color: tokens.primaryDark, fontWeight: 700, fontSize: size / 2.6 }} aria-hidden>
      {initials}
    </Avatar>
  )
}

export function Loading({ label = 'טוען…' }: { label?: string }) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 6 }} role="status" aria-live="polite">
      <CircularProgress size={32} />
      <Typography color="text.secondary">{label}</Typography>
    </Stack>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      action={
        onRetry && (
          <Button color="inherit" size="small" onClick={onRetry}>
            נסו שוב
          </Button>
        )
      }
    >
      {message}
    </Alert>
  )
}

export function Empty({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: ReactNode }) {
  return (
    <Stack alignItems="center" spacing={1} sx={{ py: 5, color: 'text.secondary', textAlign: 'center' }}>
      <Box sx={{ color: tokens.outlineVariant, '& svg': { fontSize: 48 } }}>{icon ?? <InboxIcon />}</Box>
      <Typography variant="h5" color="text.primary">
        {title}
      </Typography>
      {subtitle && <Typography variant="body2">{subtitle}</Typography>}
    </Stack>
  )
}

export function MetricCard({
  label,
  value,
  sub,
  icon,
  tone = 'primary',
  onClick,
  selected,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  tone?: Tone
  onClick?: () => void
  selected?: boolean
}) {
  const c = TONE[tone]
  return (
    <Card
      component={onClick ? 'button' : 'div'}
      onClick={onClick}
      aria-pressed={onClick ? !!selected : undefined}
      sx={{
        p: 2,
        textAlign: 'start',
        font: 'inherit',
        cursor: onClick ? 'pointer' : 'default',
        borderColor: selected ? c.fg : undefined,
        outline: selected ? `2px solid ${c.fg}` : 'none',
        bgcolor: '#fff',
        width: '100%',
        '&:focus-visible': { outline: `3px solid ${tokens.primary}` },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Typography variant="h6" color="text.secondary">
          {label}
        </Typography>
        <Box sx={{ color: c.fg, display: 'flex' }}>{icon}</Box>
      </Stack>
      <Typography sx={{ fontSize: 34, fontWeight: 800, color: c.fg, lineHeight: 1.2, mt: 0.5 }}>{value}</Typography>
      {sub && (
        <Typography variant="body2" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Card>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
      <Typography variant="h3" component="h2">
        {children}
      </Typography>
      {action}
    </Stack>
  )
}

export function Ltr({ children }: { children: ReactNode }) {
  return <bdi className="ltr">{children}</bdi>
}

export { AccessTimeIcon }
