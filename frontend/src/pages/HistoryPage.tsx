import EditCalendarIcon from '@mui/icons-material/EditCalendar'
import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useSession } from '../auth'
import { useToast } from '../components/AppShell'
import { MonthCalendar } from '../components/MonthCalendar'
import { ReportFormDialog } from '../components/dialogs'
import { fmtDayLong } from '../lib/i18n'

export default function HistoryPage() {
  const { me, meta } = useSession()
  const nav = useNavigate()
  const toast = useToast()
  const [selectedFutureDates, setSelectedFutureDates] = useState<string[]>([])
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const refresh = () => setReloadKey((key) => key + 1)
  const selectedLabel =
    selectedFutureDates.length <= 3
      ? selectedFutureDates.map(fmtDayLong).join(' · ')
      : `${selectedFutureDates.slice(0, 3).map(fmtDayLong).join(' · ')} ועוד ${selectedFutureDates.length - 3}`

  return (
    <Stack spacing={2} sx={{ maxWidth: 860, mx: 'auto' }}>
      <div>
        <Typography variant="h2" component="h1">
          לוח שנה
        </Typography>
        <Typography color="text.secondary">
          {me.full_name} · ניתן לבחור כמה ימים עתידיים לדיווח משותף
        </Typography>
      </div>
      <Box
        sx={{
          width: { xs: 'calc(100% + 32px)', md: '100%' },
          maxWidth: { xs: 'calc(100% + 32px)', md: '100%' },
          alignSelf: 'center',
          flexShrink: 0,
        }}
      >
        <MonthCalendar
          today={meta.today}
          load={(from, to) => api.myReports(from, to)}
          reloadKey={reloadKey}
          fullBleedMobile
          selectedDates={selectedFutureDates}
          onDateSelect={(date) => {
            if (date <= meta.today) {
              setSelectedFutureDates([])
              return
            }
            setSelectedFutureDates((dates) =>
              dates.includes(date) ? dates.filter((selected) => selected !== date) : [...dates, date].sort(),
            )
          }}
          renderActions={(date) =>
            date === meta.today ? (
              <Button size="small" variant="outlined" startIcon={<EditCalendarIcon />} onClick={() => nav('/')}>
                לדיווח של היום
              </Button>
            ) : null
          }
        />
      </Box>

      <ReportFormDialog
        open={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        title={selectedFutureDates.length === 1 ? 'דיווח עתידי ליום שנבחר' : `דיווח עתידי ל-${selectedFutureDates.length} ימים`}
        subtitle={
          <Stack spacing={0.5}>
            <Typography sx={{ fontWeight: 600 }}>{selectedLabel}</Typography>
            <Typography color="text.secondary">אותו סטטוס יישמר לכל הימים שנבחרו ויועבר לאישור ב-08:00 בכל תאריך.</Typography>
          </Stack>
        }
        reasons={meta.reasons}
        submitLabel={selectedFutureDates.length === 1 ? 'שמירת דיווח עתידי' : `שמירת דיווח ל-${selectedFutureDates.length} ימים`}
        onSubmit={async ({ reason_id, notes }) => {
          if (!selectedFutureDates.length) return
          const result = await api.submitMyReportDates({ report_dates: selectedFutureDates, reason_id, notes })
          refresh()
          setSelectedFutureDates([])
          toast({
            severity: result.skipped_locked.length ? 'warning' : 'success',
            message:
              (result.submitted.length === 1 ? 'הדיווח נשמר ליום אחד' : `הדיווח נשמר ל-${result.submitted.length} ימים`) +
              (result.skipped_locked.length ? ` (${result.skipped_locked.length} ימים נעולים ע״י השלישות לא שונו)` : ''),
          })
        }}
      />

      {selectedFutureDates.length > 0 && (
        <Paper
          elevation={6}
          sx={{
            position: 'fixed',
            zIndex: 1050,
            bottom: { xs: 'calc(68px + env(safe-area-inset-bottom) + 10px)', md: 24 },
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)',
            maxWidth: 480,
            p: 1,
            borderRadius: 3,
          }}
        >
          <Button fullWidth variant="contained" size="large" startIcon={<EditCalendarIcon />} onClick={() => setReportDialogOpen(true)}>
            {selectedFutureDates.length === 1 ? 'דיווח עבור יום אחד' : `דיווח עבור ${selectedFutureDates.length} ימים`}
          </Button>
        </Paper>
      )}
    </Stack>
  )
}
