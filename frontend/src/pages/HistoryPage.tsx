import { Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { Button } from '@mui/material'
import EditCalendarIcon from '@mui/icons-material/EditCalendar'
import { api } from '../api/client'
import { useSession } from '../auth'
import { MonthCalendar } from '../components/MonthCalendar'

export default function HistoryPage() {
  const { me, meta } = useSession()
  const nav = useNavigate()
  return (
    <Stack spacing={2} sx={{ maxWidth: 860, mx: 'auto' }}>
      <div>
        <Typography variant="h2" component="h1">
          היסטוריית הדיווחים שלי
        </Typography>
        <Typography color="text.secondary">
          {me.full_name} · לחיצה על יום מציגה את פרטי הדיווח
        </Typography>
      </div>
      <MonthCalendar
        today={meta.today}
        load={(from, to) => api.myReports(from, to)}
        renderActions={(date, report) =>
          date >= meta.today && report?.state !== 'hr_final' ? (
            <Button size="small" variant="outlined" startIcon={<EditCalendarIcon />} onClick={() => nav(date === meta.today ? '/' : `/?date=${date}`)}>
              {report ? 'עדכון' : 'דיווח'}
            </Button>
          ) : null
        }
      />
    </Stack>
  )
}
