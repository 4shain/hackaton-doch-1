import { Box, ButtonBase, Stack, TextField, Typography } from '@mui/material'
import type { Reason } from '../api/types'
import { tokens } from '../theme'
import { ReasonIcon } from './common'

export interface ReasonValue {
  reasonId: number | null
  notes: string
}

/** Client-side mirror of the backend `requires_notes` rule. */
export function reasonError(reasons: Reason[], v: ReasonValue): string | null {
  if (v.reasonId == null) return 'יש לבחור סטטוס.'
  const r = reasons.find((x) => x.id === v.reasonId)
  if (r?.requires_notes && !v.notes.trim()) return 'עבור סטטוס זה חובה למלא הערות.'
  if (v.notes.length > 500) return 'ההערות ארוכות מדי (עד 500 תווים).'
  return null
}

export function ReasonPicker({
  reasons,
  value,
  onChange,
  showErrors,
  idPrefix = 'reason',
}: {
  reasons: Reason[]
  value: ReasonValue
  onChange: (v: ReasonValue) => void
  showErrors?: boolean
  idPrefix?: string
}) {
  const selected = reasons.find((r) => r.id === value.reasonId)
  const notesMissing = !!selected?.requires_notes && !value.notes.trim()
  return (
    <Stack spacing={2}>
      <Box
        role="radiogroup"
        aria-label="בחירת סטטוס"
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.25 }}
      >
        {reasons.map((r) => {
          const active = r.id === value.reasonId
          return (
            <ButtonBase
              key={r.id}
              role="radio"
              aria-checked={active}
              onClick={() => onChange({ ...value, reasonId: r.id })}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'start',
                gap: 0.5,
                p: 1.5,
                minHeight: 96,
                borderRadius: 3,
                border: '2px solid',
                borderColor: active ? tokens.primary : '#e2e8f0',
                bgcolor: active ? tokens.surfaceLow : '#fff',
                boxShadow: active ? tokens.liftShadow : tokens.cardShadow,
                transition: 'all .15s',
                '&:hover': { borderColor: tokens.primary },
                '&.Mui-focusVisible': { outline: `3px solid ${tokens.primary}`, outlineOffset: 2 },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
                <ReasonIcon icon={r.icon} sx={{ color: active ? tokens.primary : tokens.onSurfaceVariant, fontSize: 26 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: active ? tokens.primary : 'text.primary', flex: 1 }}>
                  {r.label}
                </Typography>
              </Stack>
              {r.description && (
                <Typography variant="body2" color="text.secondary">
                  {r.description}
                </Typography>
              )}
              {r.requires_notes && (
                <Typography variant="caption" sx={{ color: tokens.warning, fontWeight: 600 }}>
                  * נדרשות הערות
                </Typography>
              )}
            </ButtonBase>
          )
        })}
      </Box>
      <TextField
        id={`${idPrefix}-notes`}
        label={selected?.requires_notes ? 'הערות (חובה)' : 'הערות (רשות)'}
        multiline
        minRows={2}
        value={value.notes}
        onChange={(e) => onChange({ ...value, notes: e.target.value })}
        required={!!selected?.requires_notes}
        error={!!showErrors && notesMissing}
        helperText={showErrors && notesMissing ? 'עבור סטטוס זה חובה למלא הערות.' : `${value.notes.length}/500`}
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />
    </Stack>
  )
}
