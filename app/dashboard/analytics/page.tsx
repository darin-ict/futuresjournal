'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import styles from './analytics.module.css'

type Trade = {
  id: string
  pnl: number | string | null
  entry_time: string
  exit_time: string | null
  direction: string | null
  session?: string | null
  is_open?: boolean
  [key: string]: any
}

const money = (value: number, compact = false) => {
  const abs = Math.abs(value)
  const formatted = compact && abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(2)}`
  return `${value < 0 ? '−' : value > 0 ? '+' : ''}${formatted}`
}
const pnlClass = (value: number) => value > 0 ? styles.positive : value < 0 ? styles.negative : styles.neutral
const pnlValue = (trade: Trade) => Number(trade.pnl || 0)
const validDate = (value?: string | null) => value ? new Date(value) : null
const fmtDate = (date: Date, options: Intl.DateTimeFormatOptions) => date.toLocaleDateString('en-US', options)

function Panel({ title, meta, className = '', children }: { title: string; meta?: string; className?: string; children: ReactNode }) {
  return <section className={`${styles.panel} ${className}`}>
    <div className={styles.panelHead}><h2>{title}</h2>{meta && <span>{meta}</span>}</div>
    {children}
  </section>
}

function Donut({ parts, center, caption }: { parts: { value: number; color: string }[]; center: string; caption: string }) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0)
  let cursor = 0
  const stops = parts.map(part => {
    const start = cursor
    cursor += total ? Math.max(0, part.value) / total * 100 : 0
    return `${part.color} ${start}% ${cursor}%`
  })
  return <div className={styles.donutWrap}>
    <div className={styles.donut} style={{ background: `conic-gradient(${stops.length ? stops.join(',') : '#30333b 0 100%'})` }}>
      <div className={styles.donutCenter}><strong>{center}</strong><span>{caption}</span></div>
    </div>
  </div>
}

function EquityChart({ points }: { points: { date: string; value: number }[] }) {
  const [active, setActive] = useState<number | null>(null)
  if (!points.length) return <div className={styles.emptyChart}>Your equity curve will appear once you have closed trades.</div>
  const width = 900, height = 250, padX = 12, padY = 18
  const values = [0, ...points.map(p => p.value)]
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1
  const coords = points.map((p, i) => ({ ...p, x: padX + (i / Math.max(points.length - 1, 1)) * (width - padX * 2), y: height - padY - ((p.value - min) / range) * (height - padY * 2) }))
  const line = coords.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
  const zeroY = height - padY - ((0 - min) / range) * (height - padY * 2)
  const area = `${line} L${coords[coords.length - 1].x},${zeroY} L${coords[0].x},${zeroY} Z`
  const current = coords[active ?? coords.length - 1]
  const positive = points[points.length - 1].value >= 0
  return <div className={styles.equityWrap}>
    <div className={styles.chartReadout}><div><strong className={pnlClass(current.value)}>{money(current.value)}</strong><span>{current.date}</span></div><small>Hover the curve to inspect each trade</small></div>
    <svg className={styles.equitySvg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Cumulative net profit and loss equity curve">
      <defs><linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={positive ? '#36d6a0' : '#ff6b75'} stopOpacity=".25"/><stop offset="100%" stopColor={positive ? '#36d6a0' : '#ff6b75'} stopOpacity="0"/></linearGradient></defs>
      {[0, .25, .5, .75, 1].map((step) => <line key={step} x1={padX} x2={width - padX} y1={padY + step * (height - padY * 2)} y2={padY + step * (height - padY * 2)} className={styles.gridLine}/ >)}
      <line x1={padX} x2={width - padX} y1={zeroY} y2={zeroY} className={styles.zeroLine}/>
      {coords.length > 1 && <><path d={area} fill="url(#equityFill)"/><path d={line} className={`${styles.equityLine} ${positive ? styles.lineUp : styles.lineDown}`}/></>}
      {coords.map((p, i) => <rect key={i} x={p.x - Math.max(8, (width - padX * 2) / coords.length / 2)} y="0" width={Math.max(16, (width - padX * 2) / coords.length)} height={height} fill="transparent" onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}/>)}
      {active !== null && <><line x1={current.x} x2={current.x} y1={padY} y2={height - padY} className={styles.crosshair}/><circle cx={current.x} cy={current.y} r="5" className={styles.activeDot}/></>}
    </svg>
    <div className={styles.chartAxis}><span>{points[0].date}</span><span>{points[Math.floor((points.length - 1) / 2)]?.date}</span><span>{points[points.length - 1].date}</span></div>
  </div>
}

function BarList({ items, format = 'money', positiveNegative = false }: { items: { label: string; value: number; detail?: string }[]; format?: 'money' | 'number' | 'percent'; positiveNegative?: boolean }) {
  const max = Math.max(...items.map(i => Math.abs(i.value)), 1)
  if (!items.length) return <div className={styles.emptyChart}>Not enough trade data yet.</div>
  return <div className={styles.barList}>{items.map((item, index) => {
    const width = Math.max(item.value === 0 ? 0 : 2, Math.abs(item.value) / max * 100)
    const value = format === 'money' ? money(item.value, true) : format === 'percent' ? `${item.value.toFixed(1)}%` : String(item.value)
    return <div className={styles.barRow} key={`${item.label}-${index}`}>
      <div className={styles.barTop}><span>{item.label}</span><strong className={positiveNegative ? pnlClass(item.value) : ''}>{value}</strong></div>
      <div className={styles.barTrack}><div className={`${styles.barFill} ${positiveNegative ? (item.value >= 0 ? styles.fillGreen : styles.fillRed) : ''}`} style={{ width: `${width}%` }}/></div>
      {item.detail && <small>{item.detail}</small>}
    </div>
  })}</div>
}

function Distribution({ trades }: { trades: Trade[] }) {
  const values = trades.map(pnlValue)
  const min = Math.min(...values), max = Math.max(...values)
  if (!values.length) return <div className={styles.emptyChart}>No trade outcomes to distribute yet.</div>
  const binsCount = Math.min(9, Math.max(5, Math.ceil(Math.sqrt(values.length))))
  const span = max - min || 1
  const bins = Array.from({ length: binsCount }, (_, i) => ({ low: min + span * i / binsCount, high: min + span * (i + 1) / binsCount, count: 0 }))
  values.forEach(value => { const index = Math.min(binsCount - 1, Math.floor((value - min) / span * binsCount)); bins[index].count++ })
  const peak = Math.max(...bins.map(bin => bin.count), 1)
  return <div className={styles.distribution}>
    <div className={styles.histogram}>{bins.map((bin, i) => <div className={styles.histColumn} key={i} title={`${money(bin.low)} to ${money(bin.high)} · ${bin.count} trades`}><div className={styles.histTrack}><div className={`${styles.histBar} ${bin.high <= 0 ? styles.histLoss : bin.low >= 0 ? styles.histWin : styles.histMixed}`} style={{ height: `${Math.max(bin.count ? 5 : 0, bin.count / peak * 100)}%` }}/></div><span>{bin.count}</span></div>)}</div>
    <div className={styles.histLabels}><span>{money(min, true)}</span><span>Trade P&amp;L</span><span>{money(max, true)}</span></div>
    <div className={styles.legend}><i className={styles.legendGreen}/> Profitable <i className={styles.legendRed}/> Losing</div>
  </div>
}

function Calendar({ trades }: { trades: Trade[] }) {
  const [month, setMonth] = useState(() => new Date())
  const year = month.getFullYear(), monthIndex = month.getMonth()
  const first = new Date(year, monthIndex, 1).getDay()
  const count = new Date(year, monthIndex + 1, 0).getDate()
  const pnlByDay = new Map<string, { pnl: number; count: number }>()
  trades.forEach(t => { const d = validDate(t.entry_time); if (!d) return; const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; const item = pnlByDay.get(key) || { pnl: 0, count: 0 }; item.pnl += pnlValue(t); item.count++; pnlByDay.set(key, item) })
  const thisMonth = trades.filter(t => { const d = validDate(t.entry_time); return d && d.getFullYear() === year && d.getMonth() === monthIndex })
  const monthPnl = thisMonth.reduce((sum, t) => sum + pnlValue(t), 0)
  return <div className={styles.calendarWrap}>
    <div className={styles.calendarToolbar}><button onClick={() => setMonth(new Date(year, monthIndex - 1, 1))} aria-label="Previous month">‹</button><div><strong>{fmtDate(month, { month: 'long', year: 'numeric' })}</strong><span className={pnlClass(monthPnl)}>{money(monthPnl)} <i>·</i> {thisMonth.length} trades</span></div><button onClick={() => setMonth(new Date(year, monthIndex + 1, 1))} aria-label="Next month">›</button></div>
    <div className={styles.calendarGrid}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span className={styles.calendarWeekday} key={day}>{day}</span>)}{Array.from({ length: first }, (_, i) => <span key={`blank-${i}`}/>)}{Array.from({ length: count }, (_, i) => { const day = i + 1; const d = pnlByDay.get(`${year}-${monthIndex}-${day}`); return <div key={day} className={`${styles.calendarDay} ${d ? d.pnl > 0 ? styles.calendarPositive : d.pnl < 0 ? styles.calendarNegative : styles.calendarFlat : ''}`} title={d ? `${d.count} trades · ${money(d.pnl)}` : 'No trades'}><span>{day}</span>{d && <small>{money(d.pnl, true)}</small>}</div> })}</div>
    <div className={styles.calendarLegend}><span><i className={styles.legendGreen}/> Green day</span><span><i className={styles.legendRed}/> Red day</span><span><i className={styles.legendGray}/> No trades</span></div>
  </div>
}

export default function Analytics() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const load = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) { router.push('/login'); return }
      if (alive) setUser(currentUser)
      const { data, error: fetchError } = await supabase.from('trades').select('*').eq('user_id', currentUser.id).eq('is_open', false).not('pnl', 'is', null).order('entry_time', { ascending: true })
      if (!alive) return
      if (fetchError) setError(fetchError.message)
      setTrades((data || []) as Trade[])
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [router])

  const stats = useMemo(() => {
    const wins = trades.filter(t => pnlValue(t) > 0), losses = trades.filter(t => pnlValue(t) < 0), bes = trades.filter(t => pnlValue(t) === 0)
    const grossProfit = wins.reduce((s, t) => s + pnlValue(t), 0), grossLoss = Math.abs(losses.reduce((s, t) => s + pnlValue(t), 0))
    const net = trades.reduce((s, t) => s + pnlValue(t), 0)
    const avgWin = wins.length ? grossProfit / wins.length : 0, avgLoss = losses.length ? grossLoss / losses.length : 0
    const winRate = trades.length ? (wins.length + bes.length) / trades.length * 100 : 0
    const sorted = [...trades].sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime())
    let running = 0, peak = 0, maxDrawdown = 0
    const equity = sorted.map(t => { running += pnlValue(t); peak = Math.max(peak, running); maxDrawdown = Math.max(maxDrawdown, peak - running); return { date: fmtDate(new Date(t.entry_time), { month: 'short', day: 'numeric' }), value: running } })
    let balance = 0, highWater = 0
    const ddPoints = sorted.map(t => { balance += pnlValue(t); highWater = Math.max(highWater, balance); return { date: fmtDate(new Date(t.entry_time), { month: 'short', day: 'numeric' }), value: balance - highWater } })

    const holdGroups = [{ label: '< 1 min', min: 0, max: 1 }, { label: '1–5 min', min: 1, max: 5 }, { label: '5–15 min', min: 5, max: 15 }, { label: '15–30 min', min: 15, max: 30 }, { label: '30+ min', min: 30, max: Infinity }].map(group => {
      const matching = trades.filter(t => { const start = new Date(t.entry_time).getTime(), end = t.exit_time ? new Date(t.exit_time).getTime() : NaN; const minutes = (end - start) / 60000; return Number.isFinite(minutes) && minutes >= group.min && minutes < group.max })
      const groupWins = matching.filter(t => pnlValue(t) >= 0).length
      return { label: group.label, count: matching.length, winRate: matching.length ? groupWins / matching.length * 100 : 0 }
    })
    const monthMap = new Map<string, { pnl: number; count: number }>()
    trades.forEach(t => { const d = new Date(t.entry_time); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; const item = monthMap.get(key) || { pnl: 0, count: 0 }; item.pnl += pnlValue(t); item.count++; monthMap.set(key, item) })
    const months = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([key, v]) => ({ label: fmtDate(new Date(`${key}-01T12:00:00`), { month: 'short', year: '2-digit' }), value: v.pnl, detail: `${v.count} trades` }))
    const dayMap = new Map<string, { pnl: number; count: number }>()
    trades.forEach(t => { const d = new Date(t.entry_time); const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; const item = dayMap.get(key) || { pnl: 0, count: 0 }; item.pnl += pnlValue(t); item.count++; dayMap.set(key, item) })
    const tradeDays = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([key, v]) => { const [y, m, d] = key.split('-').map(Number); return { label: fmtDate(new Date(y, m, d), { month: 'short', day: 'numeric' }), value: v.pnl, detail: `${v.count} trades` } })
    const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    const weekData = week.map(label => ({ label, value: 0, count: 0 }))
    trades.forEach(t => { const day = new Date(t.entry_time).getDay(); const index = day === 0 ? -1 : day - 1; if (index >= 0 && index < 5) { weekData[index].value += pnlValue(t); weekData[index].count++ } })
    const sessions = new Map<string, { pnl: number; count: number }>()
    trades.forEach(t => {
      const raw = String(t.session || '').trim().toUpperCase()
      let label = raw && !['RTH', 'REGULAR', 'REGULAR TRADING HOURS'].includes(raw) ? raw : ''
      if (!label) {
        const d = new Date(t.entry_time)
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
        const hour = Number(parts.find(p => p.type === 'hour')?.value || 0), minute = Number(parts.find(p => p.type === 'minute')?.value || 0), clock = hour * 60 + minute
        label = clock >= 570 && clock < 660 ? 'NY AM' : clock >= 840 && clock < 960 ? 'NY PM' : 'Other'
      }
      const item = sessions.get(label) || { pnl: 0, count: 0 }; item.pnl += pnlValue(t); item.count++; sessions.set(label, item)
    })
    const longs = trades.filter(t => String(t.direction).toUpperCase() === 'LONG').length
    const shorts = trades.filter(t => String(t.direction).toUpperCase() === 'SHORT').length
    return { wins, losses, bes, grossProfit, grossLoss, net, avgWin, avgLoss, winRate, profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0, equity, ddPoints, maxDrawdown, holdGroups, months, tradeDays, weekData, sessions: [...sessions.entries()].map(([label, v]) => ({ label, value: v.pnl, detail: `${v.count} trades` })), longs, shorts }
  }, [trades])

  if (loading) return <div className={styles.loading}><span className={styles.spinner}/><p>Putting your numbers together…</p></div>

  return <div className={styles.layout}>
    <Sidebar userEmail={user?.email || ''}/>
    <main className={styles.main}>
      <header className={styles.header}><div><span className={styles.eyebrow}>THE NUMBERS BEHIND YOUR EDGE</span><h1>Analytics<span className={styles.titleDot}>.</span></h1><p>A clearer picture of how you trade. <b>{trades.length}</b> closed trades in the journal.</p></div><div className={styles.headerMark}>F<span>/</span>J</div></header>
      {error && <div className={styles.error}>Couldn’t load trades: {error}</div>}
      {trades.length === 0 ? <div className={styles.emptyState}><span>↗</span><h2>Your stats are waiting.</h2><p>Add or import a few closed trades and this page will come alive.</p></div> : <div className={styles.content}>
        <section className={styles.kpiGrid}>
          <article className={`${styles.kpi} ${styles.kpiHero}`}><span>NET P&amp;L</span><strong className={pnlClass(stats.net)}>{money(stats.net)}</strong><small>{stats.wins.length} wins <i>·</i> {stats.losses.length} losses <i>·</i> {stats.bes.length} breakeven</small><div className={styles.kpiSpark}/></article>
          <article className={styles.kpi}><span>TRADES TAKEN</span><strong>{trades.length}</strong><small>{stats.longs} long <i>·</i> {stats.shorts} short</small></article>
          <article className={styles.kpi}><span>WIN RATE</span><strong>{stats.winRate.toFixed(1)}<em>%</em></strong><small>Breakevens count as wins</small><div className={styles.kpiMiniTrack}><i style={{ width: `${stats.winRate}%` }}/></div></article>
          <article className={styles.kpi}><span>PROFIT FACTOR</span><strong>{stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}</strong><small>{money(stats.grossProfit)} gross profit <i>·</i> {money(-stats.grossLoss)} gross loss</small></article>
          <article className={styles.kpi}><span>AVG WIN VS LOSS</span><div className={styles.avgCompare}><strong className={styles.positive}>{stats.avgWin ? money(stats.avgWin) : '—'}</strong><b>/</b><strong className={styles.negative}>{stats.avgLoss ? money(-stats.avgLoss) : '—'}</strong></div><div className={styles.avgTrack}><i style={{ width: `${stats.avgWin + stats.avgLoss ? stats.avgWin / (stats.avgWin + stats.avgLoss) * 100 : 0}%` }}/></div><small>Average winner <i>·</i> average loser</small></article>
        </section>

        <Panel title="Equity curve" meta="Cumulative net P&L" className={styles.equityPanel}><EquityChart points={stats.equity}/></Panel>

        <div className={styles.sectionGrid}>
          <Panel title="Win rate by hold time" meta="Breakevens count as wins"><div className={styles.holdGrid}>{stats.holdGroups.map(g => <div className={styles.holdItem} key={g.label}><div className={styles.holdTop}><strong>{g.winRate.toFixed(0)}%</strong><span>{g.count} trades</span></div><div className={styles.holdTrack}><i style={{ width: `${g.winRate}%` }}/></div><small>{g.label}</small></div>)}</div></Panel>
          <Panel title="Trade distribution" meta="P&L per trade"><Distribution trades={trades}/></Panel>
          <Panel title="Long vs short" meta="Position direction"><div className={styles.directionPanel}><Donut parts={[{ value: stats.longs, color: '#48d6a0' }, { value: stats.shorts, color: '#8b78ff' }]} center={`${trades.length}`} caption="trades"/><div className={styles.directionLegend}><div><i className={styles.legendGreen}/><span>Long</span><strong>{stats.longs}</strong><small>{(stats.longs / trades.length * 100).toFixed(0)}%</small></div><div><i className={styles.legendPurple}/><span>Short</span><strong>{stats.shorts}</strong><small>{(stats.shorts / trades.length * 100).toFixed(0)}%</small></div></div></div></Panel>
          <Panel title="Months" meta="Monthly net P&L"><BarList items={stats.months} positiveNegative/></Panel>
          <Panel title="Trade day" meta="Last 14 active days"><BarList items={stats.tradeDays} positiveNegative/></Panel>
          <Panel title="Day of week" meta="Net P&L by weekday"><BarList items={stats.weekData.map(d => ({ label: d.label, value: d.value, detail: `${d.count} trades` }))} positiveNegative/></Panel>
          <Panel title="P&L by session" meta="New York time for RTH trades"><BarList items={stats.sessions} positiveNegative/></Panel>
          <Panel title="Drawdown" meta="Peak-to-trough decline"><div className={styles.drawdownHeadline}><strong className={styles.negative}>{money(-stats.maxDrawdown)}</strong><span>Maximum drawdown</span></div><BarList items={stats.ddPoints.filter((_, i) => i % Math.max(1, Math.ceil(stats.ddPoints.length / 12)) === 0).map((p, i) => ({ label: p.date, value: p.value }))} positiveNegative/></Panel>
          <Panel title="Calendar" meta="Daily results at a glance" className={styles.calendarPanel}><Calendar trades={trades}/></Panel>
        </div>
      </div>}
    </main>
  </div>
}
