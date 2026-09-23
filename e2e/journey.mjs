// End-to-end UI journey: soldier -> commander -> HR, plus a ירוק בעיניים round trip.
// Requires a freshly seeded DB (uv run python -m app.cli seed --reset) and the app on BASE_URL.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const SHOTS = new URL('./screens/', import.meta.url).pathname
const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1366, height: 900 }
const results = []
const check = (name, ok) => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

const browser = await chromium.launch()

async function session(pn, viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', acceptDownloads: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('pageerror', e.message))
  await page.goto(BASE)
  await page.getByRole('button', { name: new RegExp(`כניסה בתור .*`) }).first().waitFor()
  await page.locator(`button:has-text("${pn}")`).count() // noop, keeps API symmetrical
  return { ctx, page }
}
async function loginAs(name, viewport = MOBILE, { expectGate = false } = {}) {
  const s = await session(name, viewport)
  await s.page.getByRole('button', { name: `כניסה בתור ${name}` }).click()
  if (expectGate) await s.page.getByRole('heading', { name: 'ירוק בעיניים' }).waitFor()
  else await s.page.getByRole('navigation', { name: 'ניווט ראשי' }).waitFor()
  return s
}
const shot = (page, name) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true })

// ---------------------------------------------------------------- login screen
{
  const { ctx, page } = await session('', MOBILE)
  check('document is Hebrew RTL', await page.evaluate(() => document.documentElement.lang === 'he' && document.documentElement.dir === 'rtl'))
  await shot(page, '01-login-mobile')
  await ctx.close()
}

// ---------------------------------------------------------------- soldier
{
  const { ctx, page } = await loginAs('איתי כהן')
  await page.getByText('האם אתה בבסיס?').waitFor()
  await shot(page, '02-soldier-home-mobile')
  await page.getByRole('button', { name: 'כן, אני בבסיס' }).click()
  await page.getByText('הדיווח נשלח לאישור המפקד').first().waitFor()
  check('soldier "at base" report is pending approval', await page.getByText('ממתין לאישור').first().isVisible())

  // Calendar: history and future reporting now live together.
  await page.getByRole('navigation', { name: 'ניווט ראשי' }).getByRole('button', { name: /^לוח שנה/ }).click()
  await page.getByRole('grid').waitFor()
  check('calendar shows every day of the month', (await page.getByRole('gridcell').count()) >= 28)

  // A future date with a reason that requires notes.
  await page.getByRole('button', { name: 'החודש הבא' }).click()
  await page.getByRole('gridcell').nth(4).click()
  await page.getByRole('button', { name: 'דיווח עבור יום אחד' }).click()
  const futureDialog = page.getByRole('dialog')
  await futureDialog.getByRole('radio', { name: /הפנייה רפואית/ }).click()
  await futureDialog.getByRole('button', { name: 'שמירת דיווח עתידי' }).click()
  check('required notes validated in UI', await futureDialog.getByText('עבור סטטוס זה חובה למלא הערות.').first().isVisible())
  await futureDialog.getByLabel(/הערות \(חובה\)/).fill('בדיקה בבית חולים')
  await futureDialog.getByRole('button', { name: 'שמירת דיווח עתידי' }).click()
  await page.getByText('הדיווח נשמר ליום אחד').first().waitFor()
  check('future report is scheduled', await page.getByText('מתוכנן', { exact: true }).first().isVisible())
  await shot(page, '03-soldier-future-mobile')

  // Toggle several future dates and report them together.
  for (const i of [5, 6, 7, 8, 9]) await page.getByRole('gridcell').nth(i).click()
  await page.getByRole('button', { name: 'דיווח עבור 5 ימים' }).click()
  const multiDialog = page.getByRole('dialog')
  await multiDialog.getByRole('radio', { name: /חופשה/ }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SHOTS}12-multi-day-calendar-mobile.png` })
  await multiDialog.getByRole('button', { name: 'שמירת דיווח ל-5 ימים' }).click()
  check('multi-day report saved for 5 days', await page.getByText('הדיווח נשמר ל-5 ימים').waitFor().then(() => true, () => false))

  await page.getByRole('gridcell').first().click()
  check('clicking a calendar day shows its report', await page.getByText(/דיווח החייל|לא נמצא דיווח ליום זה|טרם דווח ליום זה|חייל/).first().isVisible())
  await shot(page, '13-history-calendar-mobile')
  await page.getByRole('button', { name: 'החודש הקודם' }).click()
  await page.waitForTimeout(400)
  check('previous month navigation works', (await page.getByRole('gridcell').count()) >= 28)

  // Notifications live in a floating list on the bell (no page, no nav item).
  check('no notifications item in the navigation', (await page.getByRole('navigation', { name: 'ניווט ראשי' }).getByRole('button', { name: /^התראות/ }).count()) === 0)
  await page.getByRole('button', { name: /^התראות, / }).click()
  const pop = page.getByRole('dialog', { name: 'התראות' })
  check('bell opens a floating notifications list', await pop.waitFor().then(() => true, () => false))
  check('notifications popover is RTL', await pop.evaluate((el) => getComputedStyle(el).direction === 'rtl'))
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SHOTS}14-notifications-popover-mobile.png` })
  await page.keyboard.press('Escape')
  await ctx.close()
}

// ---------------------------------------------------------------- commander
{
  const { ctx, page } = await loginAs('עומר לוי')
  await page.getByRole('button', { name: 'החיילים שלי' }).click()
  await page.getByText('פירוט חיילים').waitFor()
  await shot(page, '04-commander-mobile')
  const itayCard = page.locator('.MuiCard-root', { hasText: 'איתי כהן' })
  const card = itayCard.filter({ has: page.getByRole('button', { name: 'אשר דיווח' }) })
  await card.getByRole('button', { name: 'אשר דיווח' }).click()
  await page.getByText('הדיווח של איתי כהן אושר והועבר לשלישות').waitFor()
  check('commander approval automatically sent soldier report to HR', await itayCard.getByText('בשלישות').isVisible())

  // Correct another soldier and approve (commander layer).
  const guy = page.locator('.MuiCard-root', { hasText: 'גיא מזרחי' }).filter({ has: page.getByRole('button', { name: 'תקן ואשר' }) })
  await guy.getByRole('button', { name: 'תקן ואשר' }).click()
  const dlg = page.getByRole('dialog')
  check('dialog (portal) is RTL', await dlg.evaluate((el) => getComputedStyle(el).direction === 'rtl'))
  await dlg.getByRole('radio', { name: /בדרך ליחידה/ }).click()
  await dlg.getByRole('button', { name: 'עדכון ואישור' }).click()
  await page.getByText('הדיווח עודכן, אושר והועבר לשלישות').waitFor()
  check('manual HR handoff button is absent', (await page.getByRole('button', { name: /לשלישות/ }).count()) === 0)
  await ctx.close()
}
{
  const { ctx, page } = await loginAs('עומר לוי', DESKTOP)
  await page.getByRole('button', { name: 'החיילים שלי' }).click()
  await page.getByText('פירוט חיילים').waitFor()
  await shot(page, '05-commander-desktop')
  await page.getByRole('button', { name: 'היסטוריית דיווחים של איתי כהן' }).click()
  const cal = page.getByRole('dialog')
  check('soldier history opens as a month calendar', await cal.getByRole('grid').waitFor().then(() => true, () => false))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}15-commander-soldier-calendar-desktop.png` })
  await page.keyboard.press('Escape')
  await ctx.close()
}

// ---------------------------------------------------------------- HR
{
  const { ctx, page } = await loginAs('מיכל פרץ', DESKTOP)
  await page.getByRole('button', { name: 'ניהול שלישות' }).click()
  const row = page.getByRole('row', { name: /איתי כהן/ })
  await row.waitFor()
  check('HR sees handed-off report', await row.getByText('בשלישות').isVisible())
  await shot(page, '06-hr-desktop')

  // Historical HR edit via the history dialog.
  await row.getByRole('button', { name: /היסטוריה של/ }).click()
  const hrCal = page.getByRole('dialog')
  await hrCal.getByRole('grid').waitFor()
  await hrCal.getByRole('gridcell').nth(9).click() // a past day in the current month
  await hrCal.getByRole('button', { name: 'עדכון שלישות' }).click()
  const dlg = page.getByRole('dialog').last()
  await dlg.getByRole('radio', { name: /חופשה/ }).click()
  await dlg.getByRole('button', { name: 'שמירת עדכון שלישות' }).click()
  await page.getByText(/העדכון נשמר/).waitFor()
  check('HR historical edit saved', true)
  check('calendar reflects HR edit', await hrCal.getByRole('gridcell').nth(9).getAttribute('aria-label').then((l) => l.includes('חופשה') && l.includes('שלישות')))
  await page.keyboard.press('Escape')

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'ייצוא CSV' }).click()])
  const path = await download.path()
  const fs = await import('node:fs')
  const buf = fs.readFileSync(path)
  check('CSV export has BOM + Hebrew headers', buf[0] === 0xef && buf[1] === 0xbb && buf.toString('utf8').includes('ת״ז'))
  await ctx.close()
}
{
  const { ctx, page } = await loginAs('מיכל פרץ', MOBILE)
  await page.getByRole('button', { name: 'ניהול שלישות' }).click()
  await page.getByText('ייצוא היסטוריה ל-CSV').waitFor()
  await shot(page, '07-hr-mobile')
  await ctx.close()
}

// ---------------------------------------------------------------- ירוק בעיניים
{
  const cmd = await loginAs('עומר לוי')
  await cmd.page.getByRole('button', { name: 'ירוק בעיניים' }).click()
  await cmd.page.getByRole('button', { name: 'שליחת בקשת ירוק בעיניים' }).click()
  await cmd.page.getByRole('button', { name: 'אישור ושליחה' }).click()
  await cmd.page.getByText(/הבקשה נשלחה ל-\d+ חיילים/).waitFor()
  await cmd.page.keyboard.press('Escape')

  const s = await loginAs('איתי כהן', MOBILE, { expectGate: true })
  check('soldier is forced to the check-in page', new URL(s.page.url()).pathname === '/checkin')
  check('app navigation is hidden while check-in is pending', (await s.page.getByRole('navigation', { name: 'ניווט ראשי' }).count()) === 0)
  await s.page.getByRole('button', { name: 'שליחת מיקום למפקד' }).click()
  check('empty location is rejected', await s.page.getByText('יש לכתוב את מיקומך הנוכחי.').first().isVisible())
  await shot(s.page, '08-checkin-gate-mobile')
  await s.page.getByLabel(/היכן אתה נמצא כעת/).fill('בבית בחיפה')
  await s.page.getByRole('button', { name: 'שליחת מיקום למפקד' }).click()
  await s.page.getByRole('navigation', { name: 'ניווט ראשי' }).waitFor()
  check('app is released after answering', new URL(s.page.url()).pathname === '/')
  check('plain soldier has no ירוק בעיניים nav item', (await s.page.getByRole('navigation', { name: 'ניווט ראשי' }).getByRole('button', { name: /^ירוק בעיניים/ }).count()) === 0)

  // A soldier already in the app is taken over by the next request (polling).
  await cmd.page.getByRole('button', { name: 'שליחת בקשת ירוק בעיניים' }).click()
  await cmd.page.getByRole('button', { name: 'אישור ושליחה' }).click()
  await cmd.page.getByText(/הבקשה נשלחה ל-\d+ חיילים/).waitFor()
  await cmd.page.keyboard.press('Escape')
  await s.page.getByRole('heading', { name: 'ירוק בעיניים' }).waitFor({ timeout: 25000 })
  check('open session is taken over by a new request', new URL(s.page.url()).pathname === '/checkin')
  await s.page.getByLabel(/היכן אתה נמצא כעת/).fill('בבסיס')
  await s.page.getByRole('button', { name: 'שליחת מיקום למפקד' }).click()
  await s.page.getByRole('navigation', { name: 'ניווט ראשי' }).waitFor()

  await cmd.page.reload()
  await cmd.page.getByText(/1\/5 השיבו/).last().click()
  const dlg = cmd.page.getByRole('dialog')
  await dlg.getByText('בבית בחיפה').waitFor()
  check('commander sees check-in response', true)
  await cmd.page.waitForTimeout(600)
  await cmd.page.screenshot({ path: `${SHOTS}09-checkin-commander-mobile.png` })
  await s.ctx.close()
  await cmd.ctx.close()
}

// ---------------------------------------------------------------- horizontal overflow check
for (const [name, vp] of [['mobile', MOBILE], ['desktop', DESKTOP]]) {
  const { ctx, page } = await loginAs('דנה אלון', vp)
  for (const nav of ['הדיווח שלי', 'לוח שנה', 'החיילים שלי', 'ירוק בעיניים', 'ניהול שלישות']) {
    await page.getByRole('navigation', { name: 'ניווט ראשי' }).getByRole('button', { name: new RegExp(`^${nav}`) }).first().click()
    await page.waitForTimeout(500)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(`no horizontal overflow: ${nav} (${name})`, overflow <= 1)
  }
  await ctx.close()
}

// ---------------------------------------------------------------- ירוק בעיניים down the chain
{
  const ron = await loginAs('רון ברק')
  await ron.page.getByRole('button', { name: /^ירוק בעיניים/ }).first().click()
  await ron.page.getByLabel('הודעה לנמענים (רשות)').fill('בדיקה גדודית')
  await ron.page.getByRole('button', { name: 'שליחת בקשת ירוק בעיניים' }).click()
  await ron.page.getByRole('button', { name: 'אישור ושליחה' }).click()
  await ron.page.getByText(/הבקשה נשלחה ל-\d+ חיילים/).waitFor()

  // Mid-level commander: forced to answer, then lands on her subordinates' status.
  const yael = await loginAs('יעל מזרחי', MOBILE, { expectGate: true })
  await yael.page.getByLabel(/היכן אתה נמצא כעת/).fill('בחמ״ל הפלוגתי')
  await yael.page.getByRole('button', { name: 'שליחת מיקום למפקד' }).click()
  await yael.page.getByRole('heading', { name: 'בקשות מהמפקד שלי' }).waitFor()
  check('commander lands on subordinates status after answering', new URL(yael.page.url()).pathname === '/checkins')
  const card = yael.page.locator('[id^="received-"]').first()
  check('commander sees own subtree status', await card.getByText(/0\/11 השיבו/).isVisible())
  await card.getByRole('button', { name: 'שליחה חוזרת לכפופים' }).click()
  await card.getByRole('button', { name: 'שליחה', exact: true }).click()
  await yael.page.getByText(/שליחה חוזרת נשלחה ל-11/).waitFor()
  await yael.page.keyboard.press('Escape')

  // Soldier: one answer covers both the original and the re-sent request.
  const s = await loginAs('איתי כהן', MOBILE, { expectGate: true })
  check('soldier is told one answer covers both requests', await s.page.getByText('תשובה אחת תישלח ל-2 בקשות פתוחות').isVisible())
  await shot(s.page, '10-checkin-gate-two-requests')
  await s.page.getByLabel(/היכן אתה נמצא כעת/).fill('בש.ג.')
  await s.page.getByRole('button', { name: 'שליחת מיקום למפקד' }).click()
  await s.page.getByRole('navigation', { name: 'ניווט ראשי' }).waitFor()

  await yael.page.reload()
  const card2 = yael.page.locator('[id^="received-"]').first()
  await card2.waitFor()
  check('subtree status updates after soldier answers', await card2.getByText(/1\/11 השיבו/).first().isVisible())
  check('re-send shows its own progress', await card2.getByText(/שליחה חוזרת שלי/).isVisible() && await card2.getByText('1/11 השיבו', { exact: true }).last().isVisible())
  check('subtree table (auto-expanded) shows the answer', await card2.getByText('בש.ג.').waitFor().then(() => true, () => false))
  await shot(yael.page, '11-commander-received-status')
  await ron.page.reload()
  check('top commander sees the answer on the original request', await ron.page.getByText(/2\/\d+ השיבו/).first().waitFor().then(() => true, () => false))
  for (const x of [ron, yael, s]) await x.ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
