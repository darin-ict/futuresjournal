'use client'
import { useState, useEffect, useId } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Fraunces } from 'next/font/google'
import Sidebar from '../../components/Sidebar'
import styles from './analytics.module.css'

// Soft, slightly rounded serif. Used for big numbers and headings only.
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['SOFT'],
  display: 'swap',
})

type Trade = {
  instrument: string
  pnl: number
  entry_time: string
  setup_tag?: string | null
  mistake_tag?: string | null
}

type Point = { date: string; value: number; pnl: number }

/* ---------- helpers ---------- */

const MINUS = '\u2212'

function money(n: number, dp = 2) {
  const body = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })
  return `${n < 0 ? MINUS : ''}$${body}`
}

function signed(n: number, dp = 2) {
  if (n === 0) return money(0, dp)
  return `${n > 0 ? '+' : MINUS}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`
}

function compact(n: number) {
  const abs = Math.abs(n)
  const body = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(0)
  return `${n > 0 ? '+' : n < 0 ? MINUS : ''}$${body}`
}

const tone = (n: number) => (n > 0 ? styles.gain : n < 0 ? styles.loss : styles.flat)

/* ---------- equity curve (the hero) ---------- */

function EquityHero({ points, total }: { points: Point[]; total: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const uid = useId().replace(/:/g, '')

  const n = points.length
  const active = hover !== null ? points[hover] : null
  const shown = active ? active.value : total

  const caption = active
    ? `Trade ${hover! + 1} on ${active.date}: ${signed(active.pnl)}`
    : `Net profit across ${n} closed ${n === 1 ? 'trade' : 'trades'}`

  if (n < 2) {
    return (
      <section aria-label="Net profit">
        <p className={`${styles.heroValue} ${tone(total)}`}>{signed(total)}</p>
        <p className={styles.heroCaption}>{caption}</p>
      </section>
    )
  }

  const W = 1000
  const H = 300
  const padY = 20
  const values = points.map(p => p.value)
  const lo = Math.min(0, ...values)
  const hi = Math.max(0, ...values)
  const span = hi - lo || 1

  const xOf = (i: number) => (i / (n - 1)) * W
  const yOf = (v: number) => padY + (1 - (v - lo) / span) * (H - padY * 2)
  const zero = yOf(0)

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.value).toFixed(1)}`)
    .join(' ')
  const area = `${line} L${W},${zero.toFixed(1)} L0,${zero.toFixed(1)} Z`

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    setHover(Math.round(t * (n - 1)))
  }

  return (
    <section aria-label="Net profit">
      <p className={`${styles.heroValue} ${tone(shown)}`}>{signed(shown)}</p>
      <p className={styles.heroCaption}>{caption}</p>

      <div
        className={styles.chart}
        role="img"
        aria-label={`Equity curve over ${n} trades, ending at ${signed(total)}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg className={styles.plot} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <clipPath id={`${uid}up`}>
              <rect x="0" y="0" width={W} height={zero} />
            </clipPath>
            <clipPath id={`${uid}down`}>
              <rect x="0" y={zero} width={W} height={H - zero} />
            </clipPath>
          </defs>
          <line x1="0" x2={W} y1={zero} y2={zero} className={styles.zeroLine} />
          <g clipPath={`url(#${uid}up)`}>
            <path d={area} className={styles.areaGain} />
            <path d={line} className={styles.lineGain} />
          </g>
          <g clipPath={`url(#${uid}down)`}>
            <path d={area} className={styles.areaLoss} />
            <path d={line} className={styles.lineLoss} />
          </g>
        </svg>

        <span className={styles.zeroLabel} style={{ top: `${(zero / H) * 100}%` }} aria-hidden="true">
          $0
        </span>

        {active && hover !== null && (
          <>
            <span className={styles.crosshair} style={{ left: `${(hover / (n - 1)) * 100}%` }} />
            <span
              className={`${styles.dot} ${active.value >= 0 ? styles.dotGain : styles.dotLoss}`}
              style={{ left: `${(hover / (n - 1)) * 100}%`, top: `${(yOf(active.value) / H) * 100}%` }}
            />
          </>
        )}
      </div>

      <div className={styles.axis} aria-hidden="true">
        <span>{points[0].date}</span>
        <span>{points[n - 1].date}</span>
      </div>
    </section>
  )
}

/* ---------- ledger-style breakdown with a centered bar ---------- */

type Row = { name: string; meta: string; pnl: number }

function Breakdown({ rows }: { rows: Row[] }) {
  const max = Math.max(...rows.map(r => Math.abs(r.pnl)), 1)
  return (
    <div>
      {rows.map(r => (
        <div key={r.name} className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowName}>{r.name}</span>
            <span className={styles.rowMeta}>{r.meta}</span>
          </div>
          <div className={styles.track} aria-hidden="true">
            <span
              className={`${styles.fill} ${r.pnl >= 0 ? styles.fillGain : styles.fillLoss}`}
              style={{ width: `${(Math.abs(r.pnl) / max) * 50}%` }}
            />
          </div>
          <span className={`${styles.rowValue} ${tone(r.pnl)}`}>{signed(r.pnl, 0)}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------- calendar of pebbles: size = how big the day was ---------- */

function CalendarView({ trades }: { trades: Trade[] }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const latest = Math.max(...trades.map(t => new Date(t.entry_time).getTime()))
    return Number.isFinite(latest) ? new Date(latest) : new Date()
  })

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const monthTrades = trades.filter(t => {
    const d = new Date(t.entry_time)
    return d.getFullYear() === year && d.getMonth() === month
  })

  const monthPnl = monthTrades.reduce((sum, t) => sum + t.pnl, 0)
  const monthWins = monthTrades.filter(t => t.pnl > 0).length
  const monthBes = monthTrades.filter(t => t.pnl === 0).length
  const monthLosses = monthTrades.filter(t => t.pnl < 0).length

  const pnlByDate: Record<string, number> = {}
  trades.forEach(t => {
    const d = new Date(t.entry_time).toDateString()
    pnlByDate[d] = (pnlByDate[d] || 0) + t.pnl
  })

  const monthDayPnls = Object.entries(pnlByDate)
    .filter(([k]) => {
      const d = new Date(k)
      return d.getFullYear() === year && d.getMonth() === month
    })
    .map(([, v]) => Math.abs(v))
  const maxDay = Math.max(...monthDayPnls, 1)

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toDateString()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(i)

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1))

  const breakdown =
    monthTrades.length === 0
      ? 'No trades this month'
      : `${monthTrades.length} ${monthTrades.length === 1 ? 'trade' : 'trades'}: ${monthWins} won, ${monthBes} breakeven, ${monthLosses} lost`

  return (
    <div>
      <div className={styles.calHead}>
        <div>
          <h3 className={styles.calMonth}>
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <p className={styles.calSummary}>
            {monthTrades.length > 0 && <span className={`${styles.calPnl} ${tone(monthPnl)}`}>{signed(monthPnl)}</span>}
            {breakdown}
          </p>
        </div>
        <div className={styles.calNav}>
          <button className={styles.iconBtn} onClick={prevMonth} aria-label="Previous month">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3 5 8l5 5" />
            </svg>
          </button>
          <button className={styles.iconBtn} onClick={nextMonth} aria-label="Next month">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 3 5 5-5 5" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.weekdays}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className={styles.calGrid}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className={styles.cellEmpty} />
          const dateStr = new Date(year, month, day).toDateString()
          const pnl = pnlByDate[dateStr]
          const hasTrades = pnl !== undefined
          const size = hasTrades ? Math.sqrt(Math.abs(pnl) / maxDay) : 0
          return (
            <div key={day} className={styles.cell} title={hasTrades ? signed(pnl) : undefined}>
              <span className={`${styles.dayNum} ${dateStr === today ? styles.dayToday : ''}`}>{day}</span>
              <div className={styles.pebbleBox} aria-hidden="true">
                {hasTrades ? (
                  <span
                    className={`${styles.pebble} ${pnl > 0 ? styles.pebbleGain : pnl < 0 ? styles.pebbleLoss : styles.pebbleFlat}`}
                    style={{ '--s': size } as React.CSSProperties}
                  />
                ) : (
                  <span className={styles.speck} />
                )}
              </div>
              <span className={`${styles.cellPnl} ${hasTrades ? tone(pnl) : ''}`}>{hasTrades ? compact(pnl) : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- page ---------- */

export default function Analytics() {
  const router = useRouter()
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      fetchTrades(user.id)
    }
    getUser()
  }, [])

  const fetchTrades = async (userId: string) => {
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .eq('is_open', false)
      .not('pnl', 'is', null)
    setTrades((data as Trade[]) || [])
    setLoading(false)
  }

  const winners = trades.filter(t => t.pnl > 0)
  const losers = trades.filter(t => t.pnl < 0)
  const breakevens = trades.filter(t => t.pnl === 0)
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const winRate = trades.length > 0 ? ((winners.length + breakevens.length) / trades.length) * 100 : 0
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length) : 0
  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0
  const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.pnl)) : 0
  const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.pnl)) : 0
  const expectancy = trades.length > 0 ? (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss : 0

  let maxConsecWins = 0, maxConsecLosses = 0, curWins = 0, curLosses = 0
  trades.forEach(t => {
    if (t.pnl > 0) { curWins++; curLosses = 0; maxConsecWins = Math.max(maxConsecWins, curWins) }
    else { curLosses++; curWins = 0; maxConsecLosses = Math.max(maxConsecLosses, curLosses) }
  })

  const sorted = [...trades].sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime())
  let cum = 0
  const equityCurve: Point[] = sorted.map(t => {
    cum += t.pnl
    return {
      date: new Date(t.entry_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      value: cum,
      pnl: t.pnl,
    }
  })

  const byInstrument: Record<string, { pnl: number; count: number; wins: number }> = {}
  trades.forEach(t => {
    if (!byInstrument[t.instrument]) byInstrument[t.instrument] = { pnl: 0, count: 0, wins: 0 }
    byInstrument[t.instrument].pnl += t.pnl
    byInstrument[t.instrument].count++
    if (t.pnl > 0) byInstrument[t.instrument].wins++
  })

  const bySetup: Record<string, { pnl: number; count: number; wins: number }> = {}
  trades.forEach(t => {
    const key = t.setup_tag || 'No Tag'
    if (!bySetup[key]) bySetup[key] = { pnl: 0, count: 0, wins: 0 }
    bySetup[key].pnl += t.pnl
    bySetup[key].count++
    if (t.pnl > 0) bySetup[key].wins++
  })

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const byDay: Record<string, { pnl: number; count: number }> = {}
  dayNames.forEach(d => { byDay[d] = { pnl: 0, count: 0 } })
  trades.forEach(t => {
    const day = dayNames[new Date(t.entry_time).getDay()]
    byDay[day].pnl += t.pnl
    byDay[day].count++
  })

  const byMistake: Record<string, { pnl: number; count: number }> = {}
  trades.filter(t => t.mistake_tag).forEach(t => {
    const key = t.mistake_tag as string
    if (!byMistake[key]) byMistake[key] = { pnl: 0, count: 0 }
    byMistake[key].pnl += t.pnl
    byMistake[key].count++
  })

  const toRows = (src: Record<string, { pnl: number; count: number; wins: number }>): Row[] =>
    Object.entries(src)
      .sort((a, b) => b[1].pnl - a[1].pnl)
      .map(([name, d]) => ({
        name,
        meta: `${d.count} ${d.count === 1 ? 'trade' : 'trades'}, ${Math.round((d.wins / d.count) * 100)}% win rate`,
        pnl: d.pnl,
      }))

  const instrumentRows = toRows(byInstrument)
  const setupRows = toRows(bySetup)

  const mistakeRows: Row[] = Object.entries(byMistake)
    .sort((a, b) => a[1].pnl - b[1].pnl)
    .map(([name, d]) => ({
      name,
      meta: `${d.count} ${d.count === 1 ? 'time' : 'times'}, ${money(d.pnl / d.count)} each`,
      pnl: d.pnl,
    }))
  const mistakeTotal = Object.values(byMistake).reduce((s, d) => s + d.pnl, 0)

  // Mon to Fri always, weekend sessions only if you actually traded them
  const shownDays = dayNames.filter((d, i) => (i >= 1 && i <= 5) || byDay[d].count > 0)
  const dayMax = Math.max(...shownDays.map(d => Math.abs(byDay[d].pnl)), 1)
  const tradedDays = shownDays.filter(d => byDay[d].count > 0)
  const bestDay = [...tradedDays].sort((a, b) => byDay[b].pnl - byDay[a].pnl)[0]
  const worstDay = [...tradedDays].sort((a, b) => byDay[a].pnl - byDay[b].pnl)[0]
  const dayNote =
    bestDay && worstDay && bestDay !== worstDay
      ? `${bestDay} is your best day and ${worstDay} your toughest.`
      : bestDay
        ? `${bestDay} is the only day you've traded so far.`
        : ''

  if (loading) {
    return (
      <div className={`${styles.loading} ${display.variable}`}>
        <span>Crunching your numbers</span>
      </div>
    )
  }

  return (
    <div className={`${styles.layout} ${display.variable}`}>
      <Sidebar userEmail={user?.email || ''} />
      <main className={styles.main}>
        <div className={styles.inner}>
          <h1 className={styles.title}>Analytics</h1>

          {trades.length === 0 ? (
            <div className={styles.empty}>
              <h2>No closed trades yet</h2>
              <p>Log a trade and close it out. Your numbers show up here.</p>
              <Link href="/dashboard/add-trade" className={styles.btn}>Log a trade</Link>
            </div>
          ) : (
            <>
              <EquityHero points={equityCurve} total={totalPnl} />

              <div className={styles.headline}>
                <div className={styles.bigStat}>
                  <span className={styles.bigNum}>{winRate.toFixed(1)}%</span>
                  <span className={styles.bigLabel}>Win rate</span>
                  <span className={styles.bigNote}>Breakevens count as wins</span>
                </div>
                <div className={styles.bigStat}>
                  <span className={styles.bigNum}>{profitFactor > 0 ? profitFactor.toFixed(2) : '\u2014'}</span>
                  <span className={styles.bigLabel}>Profit factor</span>
                  <span className={styles.bigNote}>Average win divided by average loss</span>
                </div>
                <div className={styles.bigStat}>
                  <span className={`${styles.bigNum} ${tone(expectancy)}`}>{money(expectancy)}</span>
                  <span className={styles.bigLabel}>Expectancy</span>
                  <span className={styles.bigNote}>What an average trade is worth</span>
                </div>
              </div>

              <div className={styles.ledger}>
                {[
                  { label: 'Average winner', value: money(avgWin), cls: styles.gain },
                  { label: 'Best trade', value: signed(bestTrade), cls: tone(bestTrade) },
                  { label: 'Average loser', value: avgLoss > 0 ? `${MINUS}${money(avgLoss)}` : money(0), cls: avgLoss > 0 ? styles.loss : styles.flat },
                  { label: 'Worst trade', value: signed(worstTrade), cls: tone(worstTrade) },
                  { label: 'Longest win streak', value: `${maxConsecWins}`, cls: '' },
                  { label: 'Longest losing streak', value: `${maxConsecLosses}`, cls: '' },
                ].map(s => (
                  <div key={s.label} className={styles.ledgerRow}>
                    <span>{s.label}</span>
                    <span className={`${styles.ledgerValue} ${s.cls}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              <section className={`${styles.section} ${styles.pair}`}>
                {instrumentRows.length > 0 && (
                  <div>
                    <h2 className={styles.sectionTitle}>By instrument</h2>
                    {instrumentRows.length > 1 && (
                      <p className={styles.sectionNote}>
                        {instrumentRows[0].name} is your strongest market at {signed(instrumentRows[0].pnl, 0)}.
                      </p>
                    )}
                    <Breakdown rows={instrumentRows} />
                  </div>
                )}
                {setupRows.length > 0 && (
                  <div>
                    <h2 className={styles.sectionTitle}>By setup</h2>
                    {setupRows.length > 1 && (
                      <p className={styles.sectionNote}>
                        {setupRows[0].name} is your strongest setup at {signed(setupRows[0].pnl, 0)}.
                      </p>
                    )}
                    <Breakdown rows={setupRows} />
                  </div>
                )}
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Day of the week</h2>
                {dayNote && <p className={styles.sectionNote}>{dayNote}</p>}
                <div className={styles.days} style={{ gridTemplateColumns: `repeat(${shownDays.length}, minmax(0, 1fr))` }}>
                  {shownDays.map(day => {
                    const d = byDay[day]
                    const h = d.count > 0 ? Math.max((Math.abs(d.pnl) / dayMax) * 100, 2) : 0
                    return (
                      <div key={day} className={styles.day}>
                        <div className={styles.dayPlot} aria-hidden="true">
                          <div className={styles.dayUp}>
                            {d.pnl > 0 && <span className={`${styles.dayBar} ${styles.barGain}`} style={{ height: `${h}%` }} />}
                          </div>
                          <div className={styles.dayDown}>
                            {d.pnl < 0 && <span className={`${styles.dayBar} ${styles.barLoss}`} style={{ height: `${h}%` }} />}
                          </div>
                        </div>
                        <span className={`${styles.dayPnl} ${d.count > 0 ? tone(d.pnl) : styles.flat}`}>
                          {d.count > 0 ? signed(d.pnl, 0) : '\u2014'}
                        </span>
                        <span className={styles.dayName}>{day.slice(0, 3)}</span>
                        <span className={styles.dayCount}>{d.count} {d.count === 1 ? 'trade' : 'trades'}</span>
                      </div>
                    )
                  })}
                </div>
              </section>

              {mistakeRows.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>What mistakes cost</h2>
                  <p className={styles.sectionNote}>
                    {mistakeTotal < 0
                      ? `Trades tagged with a mistake have cost you ${money(Math.abs(mistakeTotal))} in total.`
                      : `Trades tagged with a mistake still netted ${signed(mistakeTotal)} in total.`}
                  </p>
                  <div className={styles.narrow}>
                    <Breakdown rows={mistakeRows} />
                  </div>
                </section>
              )}

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Calendar</h2>
                <p className={styles.sectionNote}>Bigger pebbles mean bigger days.</p>
                <CalendarView trades={trades} />
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
