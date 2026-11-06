
'use client'
import { useState, useEffect, useId } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Fraunces } from 'next/font/google'
import Sidebar from '../../components/Sidebar'
import styles from './analytics.module.css'

// Soft, slightly rounded serif. Used for big numbers, headings and the story line.
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['SOFT'],
  style: ['normal', 'italic'],
  display: 'swap',
})

type Trade = {
  instrument: string
  direction?: string | null
  pnl: number
  entry_time: string
  exit_time?: string | null
  setup_tag?: string | null
  mistake_tag?: string | null
}

type Point = { date: string; value: number; pnl: number }

type Stats = {
  count: number
  pnl: number
  winRate: number
  avgWin: number
  avgLoss: number
  expectancy: number
  best: number
  worst: number
}

/* ---------- helpers ---------- */

const MINUS = '\u2212'
const DASH = '\u2014'

function money(n: number, dp = 2) {
  const body = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
  return `${n < 0 ? MINUS : ''}$${body}`
}

function signed(n: number, dp = 2) {
  if (n === 0) return money(0, dp)
  const body = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
  return `${n > 0 ? '+' : MINUS}$${body}`
}

function compact(n: number) {
  const abs = Math.abs(n)
  const body = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(0)
  return `${n > 0 ? '+' : n < 0 ? MINUS : ''}$${body}`
}

const tone = (n: number) => (n > 0 ? styles.gain : n < 0 ? styles.loss : styles.flat)
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

function sum(list: Trade[]) {
  return list.reduce((s, t) => s + t.pnl, 0)
}

// Always interpret trading dates and hours in New York time.
function nyParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'long',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))

  const get = (type: string) => parts.find(p => p.type === type)?.value

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: get('weekday')!,
    hour: Number(get('hour')),
  }
}

function nyDateKey(value: string | Date) {
  const p = nyParts(value)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}
function localDateKey(value: string | Date) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function calendarDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Same definitions the page has always used: breakevens count as wins for win rate.
function summarize(list: Trade[]): Stats {
  const wins = list.filter(t => t.pnl > 0)
  const losses = list.filter(t => t.pnl < 0)
  const flats = list.filter(t => t.pnl === 0)
  const winRate = list.length > 0 ? ((wins.length + flats.length) / list.length) * 100 : 0
  const avgWin = wins.length > 0 ? sum(wins) / wins.length : 0
  const avgLoss = losses.length > 0 ? Math.abs(sum(losses) / losses.length) : 0
  return {
    count: list.length,
    pnl: sum(list),
    winRate,
    avgWin,
    avgLoss,
    expectancy: list.length > 0 ? (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss : 0,
    best: list.length > 0 ? Math.max(...list.map(t => t.pnl)) : 0,
    worst: list.length > 0 ? Math.min(...list.map(t => t.pnl)) : 0,
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// Hold time only exists for trades that have an exit time (imports do, hand-added trades don't).
function holdMs(t: Trade): number | null {
  if (!t.exit_time) return null
  const a = new Date(t.entry_time).getTime()
  const b = new Date(t.exit_time).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
  return b - a
}

function fmtHold(ms: number) {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return m < 10 && s % 60 ? `${m}m ${s % 60}s` : `${m}m`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
}

function hourLabel(h: number) {
  return `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / p
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return n * p
}

const HOLD_BUCKETS = [
  { label: 'Under 1 min', max: 60_000 },
  { label: '1 to 5 min', max: 300_000 },
  { label: '5 to 15 min', max: 900_000 },
  { label: '15 to 60 min', max: 3_600_000 },
  { label: 'Over 1 hour', max: Infinity },
]

function useCountUp(target: number, ms = 1300) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dur = reduced ? 1 : ms
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

/* ---------- hero: the number and the curve ---------- */

function EquityHero({ points, total }: { points: Point[]; total: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const uid = useId().replace(/:/g, '')
  const counted = useCountUp(total)

  const n = points.length
  const active = hover !== null ? points[hover] : null
  const shown = active ? active.value : counted
  const toneValue = active ? active.value : total

  const caption = active
    ? `Trade ${hover! + 1} on ${active.date}: ${signed(active.pnl)}`
    : `Net profit across ${n} closed ${plural(n, 'trade', 'trades')}`

  if (n < 2) {
    return (
      <section aria-label="Net profit">
        <p className={`${styles.heroValue} ${tone(total)}`}>{signed(shown)}</p>
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

  const last = points[n - 1]

  return (
    <section aria-label="Net profit">
      <p className={`${styles.heroValue} ${tone(toneValue)}`}>{signed(shown)}</p>
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

        {active && hover !== null ? (
          <>
            <span className={styles.crosshair} style={{ left: `${(hover / (n - 1)) * 100}%` }} />
            <span
              className={`${styles.dot} ${active.value >= 0 ? styles.dotGain : styles.dotLoss}`}
              style={{ left: `${(hover / (n - 1)) * 100}%`, top: `${(yOf(active.value) / H) * 100}%` }}
            />
          </>
        ) : (
          <span
            className={`${styles.pulse} ${last.value >= 0 ? styles.pulseGain : styles.pulseLoss}`}
            style={{ top: `${(yOf(last.value) / H) * 100}%` }}
            aria-hidden="true"
          />
        )}
      </div>

      <div className={styles.axis} aria-hidden="true">
        <span>{points[0].date}</span>
        <span>{last.date}</span>
      </div>
    </section>
  )
}

/* ---------- longs vs shorts ---------- */

function Side({ name, kind, s, share }: { name: string; kind: 'long' | 'short'; s: Stats; share: number }) {
  const facts: string[][] = [
    ['Win rate', `${s.winRate.toFixed(1)}%`],
    ['Expectancy', money(s.expectancy)],
    ['Average winner', money(s.avgWin)],
    ['Average loser', s.avgLoss > 0 ? `${MINUS}${money(s.avgLoss)}` : money(0)],
    ['Best trade', signed(s.best)],
    ['Worst trade', signed(s.worst)],
  ]
  return (
    <div className={styles.side}>
      <div className={styles.sideHead}>
        <span className={`${styles.swatch} ${kind === 'long' ? styles.swLong : styles.swShort}`} />
        <span className={styles.sideName}>{name}</span>
      </div>
      {s.count === 0 ? (
        <p className={styles.sideEmpty}>No {name.toLowerCase()} yet</p>
      ) : (
        <>
          <p className={`${styles.sideNum} ${tone(s.pnl)}`}>{signed(s.pnl)}</p>
          <p className={styles.sideSub}>
            {s.count} {plural(s.count, 'trade', 'trades')}, {Math.round(share)}% of everything you take
          </p>
          <dl className={styles.facts}>
            {facts.map(([k, v]) => (
              <div key={k} className={styles.fact}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  )
}

function FaceOff({ longs, shorts }: { longs: Stats; shorts: Stats }) {
  const total = longs.count + shorts.count
  return (
    <div>
      <div
        className={styles.split}
        role="img"
        aria-label={`${longs.count} long trades and ${shorts.count} short trades`}
      >
        {longs.count > 0 && <span className={styles.splitLong} style={{ flex: longs.count }} />}
        {shorts.count > 0 && <span className={styles.splitShort} style={{ flex: shorts.count }} />}
      </div>
      <div className={styles.faceoff}>
        <Side name="Longs" kind="long" s={longs} share={total ? (longs.count / total) * 100 : 0} />
        <Side name="Shorts" kind="short" s={shorts} share={total ? (shorts.count / total) * 100 : 0} />
      </div>
    </div>
  )
}

/* ---------- hold time ---------- */

type HoldRow = { label: string; stats: Stats }

function HoldTime({ rows, medWin, medLoss }: { rows: HoldRow[]; medWin: number | null; medLoss: number | null }) {
  const compareMax = Math.max(medWin ?? 0, medLoss ?? 0, 1)
  return (
    <div>
      <div className={styles.holdGrid}>
        {rows.map(r => {
          const has = r.stats.count > 0
          const cls = r.stats.pnl > 0 ? styles.meterGain : r.stats.pnl < 0 ? styles.meterLoss : styles.meterFlat
          return (
            <div key={r.label} className={styles.holdCol}>
              <span className={styles.holdPct}>{has ? `${Math.round(r.stats.winRate)}%` : DASH}</span>
              <div className={styles.meter} aria-hidden="true">
                {has && <span className={`${styles.meterFill} ${cls}`} style={{ height: `${Math.max(r.stats.winRate, 2)}%` }} />}
                <span className={styles.meterMid} />
              </div>
              <span className={`${styles.holdPnl} ${has ? tone(r.stats.pnl) : styles.flat}`}>
                {has ? signed(r.stats.pnl, 0) : DASH}
              </span>
              <span className={styles.holdLabel}>{r.label}</span>
              <span className={styles.holdCount}>
                {r.stats.count} {plural(r.stats.count, 'trade', 'trades')}
              </span>
            </div>
          )
        })}
      </div>
      <p className={styles.fine}>Bar height is win rate, and the dashed line is 50%. Green means that group made money, red means it lost.</p>

      {medWin !== null && medLoss !== null && (
        <div className={styles.compare}>
          <div className={styles.cmpRow}>
            <span className={styles.cmpLabel}>Typical winner</span>
            <span className={styles.cmpTrack}>
              <span className={`${styles.cmpFill} ${styles.cmpGain}`} style={{ width: `${Math.max((medWin / compareMax) * 100, 2)}%` }} />
            </span>
            <span className={styles.cmpVal}>{fmtHold(medWin)}</span>
          </div>
          <div className={styles.cmpRow}>
            <span className={styles.cmpLabel}>Typical loser</span>
            <span className={styles.cmpTrack}>
              <span className={`${styles.cmpFill} ${styles.cmpLoss}`} style={{ width: `${Math.max((medLoss / compareMax) * 100, 2)}%` }} />
            </span>
            <span className={styles.cmpVal}>{fmtHold(medLoss)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- time of day ---------- */

type HourRow = { hour: number; stats: Stats }

function HourStrip({ rows }: { rows: HourRow[] }) {
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.stats.pnl)), 1)
  return (
    <div className={styles.hoursWrap}>
      <div className={styles.hours}>
        {rows.map(r => {
          const has = r.stats.count > 0
          const i = has ? 0.2 + 0.8 * (Math.abs(r.stats.pnl) / maxAbs) : 0
          const title = has
            ? `${hourLabel(r.hour)}: ${signed(r.stats.pnl)}, ${r.stats.count} ${plural(r.stats.count, 'trade', 'trades')}, ${Math.round(r.stats.winRate)}% win rate`
            : `${hourLabel(r.hour)}: no trades`
          return (
            <div key={r.hour} className={styles.hour} title={title}>
              <div
                className={`${styles.hourBlock} ${!has ? styles.hourEmpty : r.stats.pnl >= 0 ? styles.hourGain : styles.hourLoss}`}
                style={{ '--i': i } as React.CSSProperties}
              >
                <span className={styles.hourPnl}>{has ? compact(r.stats.pnl) : ''}</span>
              </div>
              <span className={styles.hourLabel}>{hourLabel(r.hour)}</span>
              <span className={styles.hourCount}>{has ? r.stats.count : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- after a win, after a loss ---------- */

function AfterStreak({ afterWin, afterLoss }: { afterWin: Stats; afterLoss: Stats }) {
  const cols = [
    { label: 'Next trade after a win', s: afterWin },
    { label: 'Next trade after a loss', s: afterLoss },
  ]
  return (
    <div className={styles.after}>
      {cols.map(c => (
        <div key={c.label} className={styles.afterCol}>
          <span className={styles.bigNum}>{c.s.count > 0 ? `${c.s.winRate.toFixed(1)}%` : DASH}</span>
          <span className={styles.bigLabel}>{c.label}</span>
          <span className={styles.bigNote}>
            {c.s.count > 0
              ? `${c.s.count} ${plural(c.s.count, 'trade', 'trades')} won this often, averaging ${signed(c.s.pnl / c.s.count)}`
              : 'Nothing to compare yet'}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ---------- result distribution ---------- */

function Histogram({ values }: { values: number[] }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  if (range === 0) return null

  const step = niceStep(range / 12)
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step || step
  const count = Math.min(40, Math.max(1, Math.round((end - start) / step)))
  const bins = Array.from({ length: count }, (_, i) => ({ from: start + i * step, n: 0 }))
  values.forEach(v => {
    const i = Math.min(count - 1, Math.max(0, Math.floor((v - start) / step)))
    bins[i].n++
  })
  const top = Math.max(...bins.map(b => b.n), 1)
  const zeroAt = (0 - start) / (end - start)
  const dp = step % 1 === 0 ? 0 : 2

  return (
    <div role="img" aria-label="How your trade results are spread out">
      <div className={styles.histo}>
        {bins.map((b, i) => (
          <span
            key={i}
            className={`${styles.hBar} ${b.from + step / 2 < 0 ? styles.barLoss : styles.barGain}`}
            style={{ height: b.n > 0 ? `${Math.max((b.n / top) * 100, 4)}%` : '0%' }}
            title={`${money(b.from, dp)} to ${money(b.from + step, dp)}: ${b.n} ${plural(b.n, 'trade', 'trades')}`}
          />
        ))}
        {zeroAt > 0 && zeroAt < 1 && <span className={styles.zeroTick} style={{ left: `${zeroAt * 100}%` }} />}
      </div>
      <div className={styles.histoAxis} aria-hidden="true">
        <span>{money(start, dp)}</span>
        {zeroAt > 0.08 && zeroAt < 0.92 && (
          <span className={styles.histoZero} style={{ left: `${zeroAt * 100}%` }}>$0</span>
        )}
        <span>{money(end, dp)}</span>
      </div>
    </div>
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
    const latest = trades.length > 0
      ? trades.reduce((a, b) =>
          new Date(a.entry_time).getTime() > new Date(b.entry_time).getTime() ? a : b
        )
      : null

    const d = new Date(latest ? latest.entry_time : new Date())
    return new Date(d.getFullYear(), d.getMonth(), 1, 12)
  })

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const monthTrades = trades.filter(t => {
  const d = new Date(t.entry_time)
  return d.getFullYear() === year && d.getMonth() === month
})

  const monthPnl = sum(monthTrades)
  const monthWins = monthTrades.filter(t => t.pnl > 0).length
  const monthBes = monthTrades.filter(t => t.pnl === 0).length
  const monthLosses = monthTrades.filter(t => t.pnl < 0).length

  const pnlByDate: Record<string, number> = {}
  trades.forEach(t => {
    const key = localDateKey(t.entry_time)
    pnlByDate[key] = (pnlByDate[key] || 0) + t.pnl
  })

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthDayPnls = Object.entries(pnlByDate)
    .filter(([key]) => key.startsWith(`${monthPrefix}-`))
    .map(([, value]) => Math.abs(value))

  const maxDay = Math.max(...monthDayPnls, 1)

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = localDateKey(new Date())

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(i)

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1, 12))
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1, 12))

  const breakdown =
    monthTrades.length === 0
      ? 'No trades this month'
      : `${monthTrades.length} ${plural(monthTrades.length, 'trade', 'trades')}: ${monthWins} won, ${monthBes} breakeven, ${monthLosses} lost`

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

          const dateStr = calendarDateKey(year, month, day)
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

  /* --- headline numbers --- */
  const all = summarize(trades)
  const totalPnl = all.pnl
  const winners = trades.filter(t => t.pnl > 0)
  const losers = trades.filter(t => t.pnl < 0)
  const grossProfit = sum(winners)
  const grossLoss = Math.abs(sum(losers))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0
  const payoffRatio = all.avgLoss > 0 ? all.avgWin / all.avgLoss : 0

const streakTrades = [...trades].sort(
  (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
)

let maxConsecWins = 0
let maxConsecLosses = 0
let curWins = 0
let curLosses = 0

streakTrades.forEach(t => {
  if (t.pnl > 0) {
    curWins++
    curLosses = 0
    maxConsecWins = Math.max(maxConsecWins, curWins)
  } else if (t.pnl < 0) {
    curLosses++
    curWins = 0
    maxConsecLosses = Math.max(maxConsecLosses, curLosses)
  } else {
    if (curWins > 0) {
      curWins++
      maxConsecWins = Math.max(maxConsecWins, curWins)
    } else if (curLosses > 0) {
      curLosses++
      maxConsecLosses = Math.max(maxConsecLosses, curLosses)
    }
  }
})

  const sorted = [...trades].sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime())
  let cum = 0
  let peak = 0
  let maxDrawdown = 0
  const equityCurve: Point[] = sorted.map(t => {
    cum += t.pnl
    peak = Math.max(peak, cum)
    maxDrawdown = Math.max(maxDrawdown, peak - cum)
    return {
      date: new Date(t.entry_time).toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      value: cum,
      pnl: t.pnl,
    }
  })

  const pnlByDay: Record<string, number> = {}
  trades.forEach(t => {
    const k = nyDateKey(t.entry_time)
    pnlByDay[k] = (pnlByDay[k] || 0) + t.pnl
  })
  const tradingDays = Object.keys(pnlByDay).length
  const greenDays = Object.values(pnlByDay).filter(v => v > 0).length

  /* --- longs vs shorts --- */
  const longs = summarize(trades.filter(t => t.direction === 'LONG'))
  const shorts = summarize(trades.filter(t => t.direction === 'SHORT'))

  let directionNote = ''
  let directionStory = ''
  if (longs.count > 0 && shorts.count > 0) {
    const longLeads = longs.pnl >= shorts.pnl
    const lead = longLeads ? longs : shorts
    const trail = longLeads ? shorts : longs
    const leadName = longLeads ? 'longs' : 'shorts'
    const trailName = longLeads ? 'shorts' : 'longs'
    directionNote = `Your ${leadName} have made ${signed(lead.pnl)} and your ${trailName} ${signed(trail.pnl)}.`
    if (longs.count >= 3 && shorts.count >= 3) {
      if (lead.pnl > 0 && trail.pnl > 0) directionStory = `Both sides are paying, with ${leadName} ahead at ${signed(lead.pnl)}.`
      else if (lead.pnl > 0) directionStory = `Your ${leadName} are carrying you at ${signed(lead.pnl)} while ${trailName} sit at ${signed(trail.pnl)}.`
      else directionStory = `Neither side is in profit yet.`
    }
  } else if (longs.count > 0 || shorts.count > 0) {
    directionNote = longs.count > 0 ? "You've only taken longs so far." : "You've only taken shorts so far."
  }

  /* --- hold time and time of day (needs an exit time) --- */
  const timed = trades
    .map(t => ({ t, ms: holdMs(t) }))
    .filter((x): x is { t: Trade; ms: number } => x.ms !== null)

  const bucketLists: Trade[][] = HOLD_BUCKETS.map(() => [])
  timed.forEach(({ t, ms }) => {
    const i = HOLD_BUCKETS.findIndex(b => ms < b.max)
    bucketLists[i].push(t)
  })
  const holdRows: HoldRow[] = HOLD_BUCKETS.map((b, i) => ({ label: b.label, stats: summarize(bucketLists[i]) }))

  const winHolds = timed.filter(x => x.t.pnl > 0).map(x => x.ms)
  const lossHolds = timed.filter(x => x.t.pnl < 0).map(x => x.ms)
  const medWin = median(winHolds)
  const medLoss = median(lossHolds)

  let holdNote = ''
  if (medWin !== null && medLoss !== null && winHolds.length >= 3 && lossHolds.length >= 3) {
    const w = Math.max(medWin, 1000)
    const l = Math.max(medLoss, 1000)
    if (l > w * 1.25) holdNote = `You hold losers about ${(l / w).toFixed(1)}\u00d7 longer than winners.`
    else if (w > l * 1.25) holdNote = `You let winners run about ${(w / l).toFixed(1)}\u00d7 longer than losers.`
    else holdNote = 'You hold winners and losers for about the same time.'
  }

  const hourLists: Record<number, Trade[]> = {}
  timed.forEach(({ t }) => {
    const h = nyParts(t.entry_time).hour
    if (!hourLists[h]) hourLists[h] = []
    hourLists[h].push(t)
  })
  const usedHours = Object.keys(hourLists).map(Number)
  const hourRows: HourRow[] = []
  if (usedHours.length > 0) {
    for (let h = Math.min(...usedHours); h <= Math.max(...usedHours); h++) {
      hourRows.push({ hour: h, stats: summarize(hourLists[h] || []) })
    }
  }
  const activeHours = hourRows.filter(r => r.stats.count > 0)
  const bestHour = [...activeHours].sort((a, b) => b.stats.pnl - a.stats.pnl)[0]
  const worstHour = [...activeHours].sort((a, b) => a.stats.pnl - b.stats.pnl)[0]
  const hourNote =
    activeHours.length >= 2 && bestHour.hour !== worstHour.hour
      ? `${hourLabel(bestHour.hour)} is your best hour at ${signed(bestHour.stats.pnl, 0)}, and ${hourLabel(worstHour.hour)} your toughest at ${signed(worstHour.stats.pnl, 0)}.`
      : ''
  const hourStory = activeHours.length >= 2 && bestHour.stats.pnl > 0 ? `Your best hour is ${hourLabel(bestHour.hour)}.` : ''

  const timedCaption =
    timed.length < trades.length
      ? `Based on the ${timed.length} of ${trades.length} trades that have an exit time.`
      : ''

  /* --- after a win, after a loss --- */
  const afterWinList: Trade[] = []
  const afterLossList: Trade[] = []
  sorted.forEach((t, i) => {
    if (i === 0) return
    const prev = sorted[i - 1].pnl
    if (prev > 0) afterWinList.push(t)
    else if (prev < 0) afterLossList.push(t)
  })
  const afterWin = summarize(afterWinList)
  const afterLoss = summarize(afterLossList)

  let streakNote = ''
  if (afterWin.count >= 5 && afterLoss.count >= 5) {
    const diff = afterLoss.winRate - afterWin.winRate
    if (diff < -8) streakNote = 'Trades right after a loss go worse for you than trades after a win.'
    else if (diff > 8) streakNote = 'You bounce back well. Trades after a loss do better than trades after a win.'
    else streakNote = "A win or a loss barely changes how your next trade goes."
  }

  /* --- instruments, setups, weekdays, mistakes --- */
  const byInstrument: Record<string, Trade[]> = {}
  const bySetup: Record<string, Trade[]> = {}
  trades.forEach(t => {
    ;(byInstrument[t.instrument] = byInstrument[t.instrument] || []).push(t)
    const key = t.setup_tag || 'No Tag'
    ;(bySetup[key] = bySetup[key] || []).push(t)
  })

  const toRows = (src: Record<string, Trade[]>): Row[] =>
    Object.entries(src)
      .map(([name, list]) => {
        const s = summarize(list)
        const wins = list.filter(t => t.pnl > 0).length
        return {
          name,
          meta: `${s.count} ${plural(s.count, 'trade', 'trades')}, ${Math.round((wins / s.count) * 100)}% win rate`,
          pnl: s.pnl,
        }
      })
      .sort((a, b) => b.pnl - a.pnl)

  const instrumentRows = toRows(byInstrument)
  const setupRows = toRows(bySetup)

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const byDay: Record<string, { pnl: number; count: number; wins: number }> = {}
  dayNames.forEach(d => { byDay[d] = { pnl: 0, count: 0, wins: 0 } })
  trades.forEach(t => {
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(t.entry_time).getDay()]
    byDay[day].pnl += t.pnl
    byDay[day].count++
    if (t.pnl > 0) byDay[day].wins++
  })

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

  const byMistake: Record<string, { pnl: number; count: number }> = {}
  trades.filter(t => t.mistake_tag).forEach(t => {
    const key = t.mistake_tag as string
    if (!byMistake[key]) byMistake[key] = { pnl: 0, count: 0 }
    byMistake[key].pnl += t.pnl
    byMistake[key].count++
  })
  const mistakeRows: Row[] = Object.entries(byMistake)
    .sort((a, b) => a[1].pnl - b[1].pnl)
    .map(([name, d]) => ({
      name,
      meta: `${d.count} ${plural(d.count, 'time', 'times')}, ${money(d.pnl / d.count)} each`,
      pnl: d.pnl,
    }))
  const mistakeTotal = Object.values(byMistake).reduce((s, d) => s + d.pnl, 0)

  /* --- distribution --- */
  const pnls = trades.map(t => t.pnl)
  const medianPnl = median(pnls) ?? 0
  const meanPnl = trades.length > 0 ? totalPnl / trades.length : 0

  /* --- the story line under the hero --- */
  const story = [directionStory, holdNote, hourStory].filter(Boolean).join(' ')

  if (loading) {
    return (
      <div className={`${styles.loading} ${display.variable}`}>
        <span>Crunching your numbers</span>
      </div>
    )
  }

  const hasTrades = trades.length > 0

  return (
    <div className={`${styles.layout} ${display.variable}`}>
      <Sidebar userEmail={user?.email || ''} />
      <main className={styles.main}>
        <div className={`${styles.inner} ${hasTrades ? (totalPnl >= 0 ? styles.auraUp : styles.auraDown) : ''}`}>
          <h1 className={styles.title}>Analytics</h1>

          {!hasTrades ? (
            <div className={styles.empty}>
              <h2>No closed trades yet</h2>
              <p>Log a trade and close it out. Your numbers show up here.</p>
              <Link href="/dashboard/add-trade" className={styles.btn}>Log a trade</Link>
            </div>
          ) : (
            <>
              <EquityHero points={equityCurve} total={totalPnl} />

              {story && <p className={styles.story}>{story}</p>}

              <div className={styles.headline}>
                <div className={styles.bigStat}>
                  <span className={styles.bigNum}>{all.winRate.toFixed(1)}%</span>
                  <span className={styles.bigLabel}>Win rate</span>
                  <span className={styles.bigNote}>Breakevens count as wins</span>
                </div>
                <div className={styles.bigStat}>
                  <span className={styles.bigNum}>{profitFactor > 0 ? profitFactor.toFixed(2) : DASH}</span>
                  <span className={styles.bigLabel}>Profit factor</span>
                  <span className={styles.bigNote}>Total won divided by total lost</span>
                </div>
                <div className={styles.bigStat}>
                  <span className={`${styles.bigNum} ${tone(all.expectancy)}`}>{money(all.expectancy)}</span>
                  <span className={styles.bigLabel}>Expectancy</span>
                  <span className={styles.bigNote}>What an average trade is worth</span>
                </div>
              </div>

              <div className={styles.ledger}>
                {[
                  { label: 'Average winner', value: money(all.avgWin), cls: styles.gain },
                  { label: 'Best trade', value: signed(all.best), cls: tone(all.best) },
                  { label: 'Average loser', value: all.avgLoss > 0 ? `${MINUS}${money(all.avgLoss)}` : money(0), cls: all.avgLoss > 0 ? styles.loss : styles.flat },
                  { label: 'Worst trade', value: signed(all.worst), cls: tone(all.worst) },
                  { label: 'Payoff ratio', value: payoffRatio > 0 ? payoffRatio.toFixed(2) : DASH, cls: '' },
                  { label: 'Max drawdown', value: maxDrawdown > 0 ? `${MINUS}${money(maxDrawdown)}` : money(0), cls: maxDrawdown > 0 ? styles.loss : styles.flat },
                  { label: 'Longest win streak', value: `${maxConsecWins}`, cls: '' },
                  { label: 'Longest losing streak', value: `${maxConsecLosses}`, cls: '' },
                  { label: 'Green days', value: `${greenDays} of ${tradingDays}`, cls: '' },
                  { label: 'Trades per day', value: (trades.length / Math.max(tradingDays, 1)).toFixed(1), cls: '' },
                ].map(s => (
                  <div key={s.label} className={styles.ledgerRow}>
                    <span>{s.label}</span>
                    <span className={`${styles.ledgerValue} ${s.cls}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              {longs.count + shorts.count > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Longs and shorts</h2>
                  {directionNote && <p className={styles.sectionNote}>{directionNote}</p>}
                  <FaceOff longs={longs} shorts={shorts} />
                </section>
              )}

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>How long you hold</h2>
                {timed.length >= 3 ? (
                  <>
                    <p className={styles.sectionNote}>
                      {holdNote || 'Win rate and profit for every hold length.'} {timedCaption}
                    </p>
                    <HoldTime rows={holdRows} medWin={medWin} medLoss={medLoss} />
                  </>
                ) : (
                  <p className={styles.sectionNote}>
                    Hold time needs an exit time. Trades imported from Tradovate or a CSV have one. Trades you add by hand don&apos;t.
                  </p>
                )}
              </section>

              {timed.length >= 3 && hourRows.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Time of day</h2>
                  <p className={styles.sectionNote}>
                    {hourNote || 'Net profit for the hour each trade started.'} {timedCaption}
                  </p>
                  <HourStrip rows={hourRows} />
                </section>
              )}

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>After a win, after a loss</h2>
                {streakNote && <p className={styles.sectionNote}>{streakNote}</p>}
                <AfterStreak afterWin={afterWin} afterLoss={afterLoss} />
              </section>

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
                          {d.count > 0 ? signed(d.pnl, 0) : DASH}
                        </span>
                        <span className={styles.dayName}>{day.slice(0, 3)}</span>
                        <span className={styles.dayCount}>
                          {d.count} {plural(d.count, 'trade', 'trades')}
                          {d.count > 0 ? `, ${Math.round((d.wins / d.count) * 100)}% won` : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>How your results are spread</h2>
                <p className={styles.sectionNote}>
                  The typical trade makes {signed(medianPnl)}. The average is {signed(meanPnl)}.
                </p>
                <Histogram values={pnls} />
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
