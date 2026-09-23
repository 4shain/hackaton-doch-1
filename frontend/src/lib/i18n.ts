import type { LayerSource, ReportState } from '../api/types'

const ERRORS: Record<string, string> = {
  UNAUTHENTICATED: 'פג תוקף ההתחברות. יש להתחבר מחדש.',
  FORBIDDEN: 'אין לך הרשאה לבצע פעולה זו.',
  NOT_FOUND: 'הפריט לא נמצא.',
  NETWORK_ERROR: 'אין חיבור לשרת. בדקו את החיבור ונסו שוב.',
  VALIDATION_ERROR: 'הנתונים שנשלחו אינם תקינים.',
  CONFLICT: 'הפעולה מתנגשת בנתונים קיימים.',
  UNKNOWN: 'אירעה שגיאה לא צפויה. נסו שוב.',
  ID_LOGIN_DISABLED: 'הכניסה לפי תעודת זהות מושבתת בסביבה זו.',
  SSO_NOT_CONFIGURED: 'כניסה בהזדהות אחודה (SSO) טרם הוגדרה בסביבה זו.',
  USER_NOT_FOUND: 'תעודת הזהות לא נמצאה במערכת.',
  NOTES_REQUIRED: 'עבור סטטוס זה חובה למלא הערות.',
  NOTES_TOO_LONG: 'ההערות ארוכות מדי (עד 500 תווים).',
  INVALID_REASON: 'הסטטוס שנבחר אינו תקין.',
  PAST_DATE_NOT_ALLOWED: 'לא ניתן לדווח על תאריך שעבר. לתיקון היסטורי יש לפנות לשלישות.',
  DATE_TOO_FAR: 'ניתן לדווח עד שבוע קדימה.',
  DUPLICATE_REPORT: 'כבר קיים דיווח לתאריך זה.',
  REPORT_LOCKED_BY_COMMANDER: 'הדיווח אושר או עודכן ע״י המפקד ונעול לשינויים. לשינוי יש לפנות למפקד.',
  REPORT_LOCKED_BY_HR: 'הדיווח עודכן ע״י השלישות ונעול לשינויים. לשינוי יש לפנות לשלישות.',
  REPORT_NOT_FOUND: 'הדיווח לא נמצא.',
  NOTHING_TO_REPORT: 'יש לבחור לפחות יום אחד לדיווח.',
  COMMANDER_EDIT_TODAY_ONLY: 'מפקד יכול לשנות דיווחים של היום בלבד. שינוי היסטורי מתבצע בשלישות.',
  NOT_YOUR_SOLDIER: 'החייל אינו תחת פיקודך.',
  NOT_A_COMMANDER: 'פעולה זו זמינה למפקדים בלבד.',
  NOT_HR: 'פעולה זו זמינה לשלישות בלבד.',
  NOT_IN_HR_UNIT: 'החייל אינו שייך ליחידה שבאחריותך.',
  INVALID_DATE_RANGE: 'טווח התאריכים אינו תקין.',
  DATE_RANGE_TOO_LONG: 'ניתן לייצא עד שנה אחת בכל פעם.',
  DATE_RANGE_TOO_LONG_REPORT: 'ניתן לדווח עד 31 ימים בבת אחת.',
  NO_SUBORDINATES: 'אין חיילים תחת פיקודך לשליחת בקשה.',
  CHECKIN_NOT_FOUND: 'הבקשה לא נמצאה.',
  NOT_YOUR_CHECKIN: 'הבקשה לא נשלחה על ידך.',
  NOT_A_RECIPIENT: 'הבקשה לא נשלחה אליך.',
  CHECKIN_CLOSED: 'הבקשה נסגרה ע״י המפקד ולא ניתן לעדכן אותה.',
  LOCATION_REQUIRED: 'יש לכתוב את מיקומך הנוכחי.',
  LOCATION_TOO_LONG: 'תיאור המיקום ארוך מדי (עד 300 תווים).',
  NOTIFICATION_NOT_FOUND: 'ההתראה לא נמצאה.',
  UNIT_HIERARCHY_CYCLE: 'לא ניתן ליצור מעגל בהיררכיית היחידות.',
  ANOMALY_SCAN_NOT_CONFIGURED: 'סריקת החריגות אינה מוגדרת בשרת (חסר מפתח API).',
}

export const translateError = (code: string) => ERRORS[code] ?? ERRORS.UNKNOWN

export const STATE_LABEL: Record<ReportState, string> = {
  scheduled: 'מתוכנן · ייכנס לאישור ב-08:00',
  pending_approval: 'ממתין לאישור מפקד',
  approved: 'אושר ע״י מפקד',
  sent_to_hr: 'הועבר לשלישות',
  hr_final: 'עודכן ע״י שלישות',
}

export const STATE_SHORT: Record<ReportState, string> = {
  scheduled: 'מתוכנן',
  pending_approval: 'ממתין לאישור',
  approved: 'אושר',
  sent_to_hr: 'בשלישות',
  hr_final: 'סופי (שלישות)',
}

export const SOURCE_LABEL: Record<LayerSource, string> = {
  soldier: 'דיווח החייל',
  commander: 'עדכון מפקד',
  hr: 'עדכון שלישות',
}

export const AUDIT_ACTION: Record<string, string> = {
  seeded: 'נתוני הדגמה',
  soldier_submitted: 'החייל דיווח',
  soldier_updated: 'החייל עדכן דיווח',
  soldier_updated_approval_invalidated: 'החייל שינה דיווח מאושר – האישור בוטל',
  commander_approved: 'המפקד אישר',
  commander_corrected_and_approved: 'המפקד תיקן ואישר',
  commander_reported_on_behalf: 'המפקד דיווח בשם החייל',
  sent_to_hr: 'הועבר לשלישות',
  hr_set: 'השלישות עדכנה',
  hr_updated: 'השלישות עדכנה שוב',
  hr_reported_on_behalf: 'השלישות דיווחה בשם החייל',
  activated_by_daily_job: 'הועבר לאישור בעיבוד של 08:00',
}

export const ROLE_LABEL: Record<string, string> = {
  soldier: 'חייל',
  commander: 'מפקד',
  hr: 'שלישות',
  system: 'מערכת',
}

// ---------------------------------------------------------------- dates (Asia/Jerusalem)

const TZ = 'Asia/Jerusalem'

/** Parse a YYYY-MM-DD string as a calendar date (noon UTC avoids DST edge cases). */
export const parseDay = (iso: string) => new Date(`${iso}T12:00:00Z`)

export const addDays = (iso: string, n: number) => {
  const d = parseDay(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parseDay(iso))

export const fmtDayLong = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(parseDay(iso))

export const fmtDayNum = (iso: string) => parseDay(iso).getUTCDate()

export const fmtWeekdayShort = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', { weekday: 'narrow', timeZone: 'UTC' }).format(parseDay(iso))

export const fmtTime = (ts: string | null | undefined) =>
  ts ? new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(ts)) : ''

export const fmtDateTime = (ts: string | null | undefined) =>
  ts
    ? new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(ts))
    : ''

export const relativeDayLabel = (iso: string, today: string) => {
  if (iso === today) return 'היום'
  if (iso === addDays(today, 1)) return 'מחר'
  if (iso === addDays(today, -1)) return 'אתמול'
  return ''
}

// ---------------------------------------------------------------- months

/** YYYY-MM of a YYYY-MM-DD string. */
export const monthOf = (iso: string) => iso.slice(0, 7)

export const addMonths = (ym: string, n: number) => {
  const d = parseDay(`${ym}-01`)
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 7)
}

export const monthRange = (ym: string) => {
  const first = `${ym}-01`
  const last = addDays(`${addMonths(ym, 1)}-01`, -1)
  return { first, last }
}

export const fmtMonth = (ym: string) =>
  new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parseDay(`${ym}-01`))

export const daysBetween = (from: string, to: string) => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86400000)
