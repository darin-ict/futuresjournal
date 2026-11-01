'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '../../components/Sidebar'
import styles from './analytics.module.css'

function EquityCurveChart({ data }: { data: { date: string; value: number }[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (!data || data.length < 2) return null

  const values = data.map(d => d.value)
  const minVal = Math.min(0, ...values)
  const maxVal = Math.max(0, ...values)
  const range = maxVal - minVal || 1

  const width = 800
  const height = 220
  const padding = 30

  // Convert points to SVG coordinates
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((d.value - minVal) / range) * (height - padding * 2)
    return { x, y, date: d.date, value: d.value }
  })

  // Zero-line Y position
  const zeroY = height - padding - ((0 - minVal) / range) * (height - padding * 2)

  // Construct smooth line SVG path
  const linePath = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`
  }, '')

  // Closed path for subtle gradient fill
  const areaPath = `${linePath} L ${points[points.length - 1].x},${zeroY} L ${points[0].x},${zeroY} Z`

  const finalValue = data[data.length - 1]?.value || 0
  const lineColor = finalValue >= 0 ? 'var(--accent-green, #00d4aa)' : 'var(--accent-red, #ff4757)'
  const activePoint = hoverIndex !== null ? points[hoverIndex] : points[points.length - 1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Active Balance Display */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ fontSize: '24px', fontWeight: '800', color: activePoint.value >= 0 ? 'var(--accent-green, #00d4aa)' : 'var(--accent-red, #ff4757)' }}>
            {activePoint.value >= 0 ? '+' : ''}${activePoint.value.toFixed(2)}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted, #888)' }}>
            {activePoint.date}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>
          Hover over line for trade history
        </span>
      </div>

      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={lineColor} floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Background Grid Lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--border, #262626)" strokeDasharray="4 4" opacity="0.5" />
          <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="var(--text-muted, #555)" strokeDasharray="2 2" opacity="0.7" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border, #262626)" strokeDasharray="4 4" opacity="0.5" />

          {/* Area Fill */}
          <path d={areaPath} fill="url(#equityGradient)" />

          {/* Main Line */}
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5" filter="url(#glow)" strokeLinecap="round" strokeLinejoin="round" />

          {/* Interactive Hover Markers */}
          {points.map((p, i) => (
            <g key={i}>
              <rect
                x={p.x - (width - padding * 2) / (points.length * 2)}
                y={0}
                width={(width - padding * 2) / points.length}
                height={height}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
              {hoverIndex === i && (
                <>
                  <line x1={p.x} y1={padding} x2={p.x} y2={height - padding} stroke="var(--text-muted, #888)" strokeDasharray="3 3" opacity="0.6" />
                  <circle cx={p.x} cy={p.y} r="5" fill={lineColor} stroke="var(--bg-primary, #000)" strokeWidth="2" />
                </>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

function CalendarView({ trades }: { trades: any[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

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

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toDateString()

  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <button onClick={prevMonth} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '14px' }}>← Prev</button>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center' }}>
          <span style={{ fontSize: '16px', fontWeight: '800' }}>
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--border)' }}>
            <span style={{ fontWeight: '700', color: monthPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {monthPnl >= 0 ? '+' : ''}${monthPnl.toFixed(2)}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)' }}>{monthTrades.length} trades</span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--accent-green)' }}>{monthWins}W</span>
            <span style={{ color: 'var(--text-muted)' }}>{monthBes}BE</span>
            <span style={{ color: 'var(--accent-red)' }}>{monthLosses}L</span>
          </div>
        </div>

        <button onClick={nextMonth} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '14px' }}>Next →</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />
          const dateStr = new Date(year, month, day).toDateString()
          const pnl = pnlByDate[dateStr]
          const isToday = dateStr === today
          const hasTradesWon = pnl > 0
          const hasTradesLost = pnl < 0
          const hasTrades = pnl !== undefined
          return (
            <div
              key={day}
              title={hasTrades ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : ''}
              style={{
                padding: '6px 4px',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: hasTrades ? '700' : '400',
                background: hasTradesWon ? 'rgba(0,212,170,0.12)' : hasTradesLost ? 'rgba(255,71,87,0.1)' : hasTrades ? 'rgba(108,99,255,0.12)' : 'var(--bg-secondary)',
                border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
                color: hasTradesWon ? 'var(--accent-green)' : hasTradesLost ? 'var(--accent-red)' : hasTrades ? '#6c63ff' : 'var(--text-muted)',
                cursor: hasTrades ? 'pointer' : 'default',
                minHeight: '52px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                justifyContent: 'center',
              }}
            >
              <span>{day}</span>
              {hasTrades && (
                <span style={{ fontSize: '10px', fontWeight: '600' }}>
                  {pnl >= 0 ? '+' : ''}${Math.abs(pnl) >= 1000 ? (pnl / 1000).toFixed(1) + 'k' : pnl.toFixed(0)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


function formatDuration(totalMinutes: number) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0m'
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = Math.round(totalMinutes % 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function TimeInvestedChart({ data }: { data: { label: string; minutes: number }[] }) {
  const max = Math.max(...data.map(d => d.minutes), 1)
  return (
    <div className={styles.timeChart}>
      <div className={styles.timeChartScale}>
        <span>{formatDuration(max)}</span>
        <span>{formatDuration(max / 2)}</span>
        <span>0</span>
      </div>
      <div className={styles.timeChartPlot}>
        <div className={styles.chartGridLine} />
        <div className={styles.chartGridLine} />
        <div className={styles.chartGridLine} />
        {data.map((item, index) => (
          <div className={styles.timeBarColumn} key={`${item.label}-${index}`} title={`${item.label}: ${formatDuration(item.minutes)}`}>
            <div className={styles.timeBarTrack}>
              <div className={styles.timeBar} style={{ height: `${Math.max((item.minutes / max) * 100, item.minutes > 0 ? 2 : 0)}%` }} />
            </div>
            <span className={styles.timeBarLabel}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Donut({ percent, color = 'purple' }: { percent: number; color?: 'purple' | 'green' }) {
  const safePercent = Math.max(0, Math.min(100, percent))
  return (
    <div
      className={`${styles.donut} ${color === 'green' ? styles.donutGreen : ''}`}
      style={{ background: `conic-gradient(var(--donut-color) ${safePercent * 3.6}deg, var(--donut-track) 0deg)` }}
      aria-label={`${safePercent.toFixed(1)} percent`}
    >
      <div className={styles.donutHole} />
    </div>
  )
}

export default function Analytics() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [trades, setTrades] = useState<any[]>([])
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
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .eq('is_open', false)
      .not('pnl', 'is', null)
      .order('entry_time', { ascending: true })

    if (error) console.error('Failed to load analytics trades:', error)
    setTrades(data || [])
    setLoading(false)
  }

  const winners = trades.filter(t => Number(t.pnl) > 0)
  const losers = trades.filter(t => Number(t.pnl) < 0)
  const breakevens = trades.filter(t => Number(t.pnl) === 0)
  const totalPnl = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0)
  const grossProfit = winners.reduce((sum, t) => sum + Number(t.pnl), 0)
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + Number(t.pnl), 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0
  const avgWin = winners.length ? grossProfit / winners.length : 0
  const avgLoss = losers.length ? grossLoss / losers.length : 0
  // Keep the journal's existing convention: breakeven trades count as wins in win rate.
  const winRate = trades.length ? ((winners.length + breakevens.length) / trades.length) * 100 : 0
  const longTrades = trades.filter(t => t.direction === 'LONG').length
  const shortTrades = trades.filter(t => t.direction === 'SHORT').length
  const longPercent = trades.length ? (longTrades / trades.length) * 100 : 0

  const durations = trades.map(t => {
    const start = new Date(t.entry_time).getTime()
    const end = new Date(t.exit_time).getTime()
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? (end - start) / 60000 : 0
  })
  const totalMinutes = durations.reduce((sum, value) => sum + value, 0)
  const timedTrades = durations.filter(value => value > 0).length

  const dailyMinutes: Record<string, number> = {}
  trades.forEach((trade, index) => {
    if (durations[index] <= 0) return
    const date = new Date(trade.entry_time)
    const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    dailyMinutes[key] = (dailyMinutes[key] || 0) + durations[index]
  })
  const timeChartData = Object.entries(dailyMinutes).slice(-12).map(([label, minutes]) => ({ label, minutes }))

  const sorted = [...trades].sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime())
  let runningPnl = 0
  const equityCurve = sorted.map(t => {
    runningPnl += Number(t.pnl || 0)
    return {
      date: new Date(t.entry_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: runningPnl,
    }
  })

  const byInstrument: Record<string, { pnl: number; count: number; wins: number }> = {}
  const bySetup: Record<string, { pnl: number; count: number; wins: number }> = {}
  const byMistake: Record<string, { pnl: number; count: number }> = {}
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const byDay: Record<string, { pnl: number; count: number }> = {}
  days.forEach(day => { byDay[day] = { pnl: 0, count: 0 } })

  trades.forEach(t => {
    const instrument = t.instrument || 'Unknown'
    if (!byInstrument[instrument]) byInstrument[instrument] = { pnl: 0, count: 0, wins: 0 }
    byInstrument[instrument].pnl += Number(t.pnl || 0)
    byInstrument[instrument].count++
    if (Number(t.pnl) > 0) byInstrument[instrument].wins++

    const setup = t.setup_tag || 'No Tag'
    if (!bySetup[setup]) bySetup[setup] = { pnl: 0, count: 0, wins: 0 }
    bySetup[setup].pnl += Number(t.pnl || 0)
    bySetup[setup].count++
    if (Number(t.pnl) > 0) bySetup[setup].wins++

    const weekday = days[new Date(t.entry_time).getDay()]
    byDay[weekday].pnl += Number(t.pnl || 0)
    byDay[weekday].count++

    if (t.mistake_tag) {
      if (!byMistake[t.mistake_tag]) byMistake[t.mistake_tag] = { pnl: 0, count: 0 }
      byMistake[t.mistake_tag].pnl += Number(t.pnl || 0)
      byMistake[t.mistake_tag].count++
    }
  })

  const maxAbs = (values: number[]) => Math.max(...values.map(Math.abs), 1)
  const money = (value: number) => `${value < 0 ? '-' : value > 0 ? '+' : ''}$${Math.abs(value).toFixed(2)}`

  if (loading) {
    return <div className={styles.loadingScreen}><div className={styles.loadingSpinner} /><p>Loading analytics...</p></div>
  }

  return (
    <div className={styles.layout}>
      <Sidebar userEmail={user?.email || ''} />
      <main className={styles.main}>
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <span className={styles.pageEyebrow}>JOURNAL / PERFORMANCE</span>
            <span className={styles.pageTitle}>Analytics</span>
            <span className={styles.pageSubtitle}>Your trading performance at a glance · {trades.length} closed trades</span>
          </div>
          <Link href="/dashboard/trades" className={styles.topAction}>View trades <span>↗</span></Link>
        </header>

        {trades.length === 0 ? (
          <div className={styles.content}>
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>⌁</span>
              <h3>No closed trades yet</h3>
              <p>Log or import trades to see your performance analytics.</p>
              <Link href="/dashboard/add-trade" className={styles.btnPrimary}>+ Log Trade</Link>
            </div>
          </div>
        ) : (
          <div className={styles.content}>
            <section className={styles.heroGrid}>
              <article className={styles.metricCard}>
                <span className={styles.metricLabel}>Net P&amp;L</span>
                <strong className={`${styles.metricValue} ${totalPnl >= 0 ? styles.green : styles.red}`}>{money(totalPnl)}</strong>
                <span className={styles.metricFoot}>{winners.length} wins · {losers.length} losses · {breakevens.length} BE</span>
              </article>

              <article className={styles.metricCard}>
                <span className={styles.metricLabel}>Profit factor</span>
                <div className={styles.metricInline}>
                  <strong className={styles.metricValue}>{grossLoss > 0 ? profitFactor.toFixed(2) : grossProfit > 0 ? '∞' : '—'}</strong>
                  <Donut percent={grossProfit + grossLoss > 0 ? grossProfit / (grossProfit + grossLoss) * 100 : 0} />
                </div>
                <span className={styles.metricFoot}>{money(grossProfit)} gross profit · {money(-grossLoss)} gross loss</span>
              </article>

              <article className={styles.metricCard}>
                <span className={styles.metricLabel}>Avg win vs. loss</span>
                <div className={styles.averageCompare}>
                  <div className={styles.averageRow}>
                    <strong className={styles.green}>{money(avgWin)}</strong>
                    <span className={styles.compareDash} />
                  </div>
                  <div className={styles.compareTrack}>
                    <div className={styles.compareWin} style={{ width: `${avgWin + avgLoss > 0 ? avgWin / (avgWin + avgLoss) * 100 : 0}%` }} />
                  </div>
                  <div className={styles.averageRow}>
                    <span className={styles.metricFoot}>Average loss</span>
                    <strong className={styles.red}>{avgLoss ? `-${avgLoss.toFixed(2)}` : '—'}</strong>
                  </div>
                </div>
              </article>
            </section>

            <section className={styles.overviewGrid}>
              <div className={styles.smallStatsGrid}>
                <article className={styles.statPanel}>
                  <span className={styles.metricLabel}>Time invested</span>
                  <strong className={styles.statValue}>{formatDuration(totalMinutes)}</strong>
                  <span className={styles.metricFoot}>{timedTrades} trades with valid entry/exit times</span>
                </article>
                <article className={styles.statPanel}>
                  <span className={styles.metricLabel}>Time replayed</span>
                  <strong className={styles.statValue}>Not tracked</strong>
                  <span className={styles.metricFoot}>Replay duration isn't stored in your trade data</span>
                </article>
                <article className={styles.statPanel}>
                  <span className={styles.metricLabel}>Trades taken</span>
                  <div className={styles.statBottom}>
                    <div>
                      <strong className={styles.statValue}>{trades.length}</strong>
                      <span className={styles.metricFoot}>{longPercent.toFixed(0)}% long · {(100 - longPercent).toFixed(0)}% short</span>
                    </div>
                    <Donut percent={longPercent} />
                  </div>
                </article>
                <article className={styles.statPanel}>
                  <span className={styles.metricLabel}>Win rate</span>
                  <div className={styles.statBottom}>
                    <div>
                      <strong className={styles.statValue}>{winRate.toFixed(1)}%</strong>
                      <span className={styles.metricFoot}>{winners.length + breakevens.length}W · {losers.length}L (BE counted as wins)</span>
                    </div>
                    <Donut percent={winRate} color="green" />
                  </div>
                </article>
              </div>

              <article className={`${styles.panel} ${styles.timePanel}`}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Time invested</span>
                  <span className={styles.panelMeta}>By trading day</span>
                </div>
                {timeChartData.length ? <TimeInvestedChart data={timeChartData} /> : (
                  <div className={styles.chartEmpty}>Entry and exit times are needed to calculate time invested.</div>
                )}
              </article>
            </section>

            <section className={styles.lowerGrid}>
              {equityCurve.length > 1 && (
                <article className={`${styles.panel} ${styles.widePanel}`}>
                  <div className={styles.panelHeader}>
                    <span className={styles.panelTitle}>Equity curve</span>
                    <span className={`${styles.panelMeta} ${totalPnl >= 0 ? styles.green : styles.red}`}>{money(totalPnl)} net</span>
                  </div>
                  <EquityCurveChart data={equityCurve} />
                </article>
              )}

              <article className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>By instrument</span></div>
                <div className={styles.breakdownTable}>
                  <div className={styles.breakdownHead}><span>Instrument</span><span>Trades</span><span>WR</span><span>P&amp;L</span></div>
                  {Object.entries(byInstrument).sort((a, b) => b[1].pnl - a[1].pnl).map(([name, d]) => (
                    <div className={styles.breakdownRow} key={name}>
                      <strong>{name}</strong><span>{d.count}</span><span>{Math.round(d.wins / d.count * 100)}%</span><span className={d.pnl >= 0 ? styles.green : styles.red}>{money(d.pnl)}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>By setup</span></div>
                <div className={styles.breakdownTable}>
                  <div className={styles.breakdownHead}><span>Setup</span><span>Trades</span><span>WR</span><span>P&amp;L</span></div>
                  {Object.entries(bySetup).sort((a, b) => b[1].pnl - a[1].pnl).map(([name, d]) => (
                    <div className={styles.breakdownRow} key={name}>
                      <strong>{name}</strong><span>{d.count}</span><span>{Math.round(d.wins / d.count * 100)}%</span><span className={d.pnl >= 0 ? styles.green : styles.red}>{money(d.pnl)}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Performance by day</span></div>
                <div className={styles.dayGrid}>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                    const d = byDay[day]
                    return <div className={styles.dayCard} key={day}>
                      <span className={styles.dayName}>{day.slice(0, 3)}</span>
                      <strong className={d.pnl > 0 ? styles.green : d.pnl < 0 ? styles.red : ''}>{d.count ? money(d.pnl) : '—'}</strong>
                      <span className={styles.metricFoot}>{d.count} trades</span>
                    </div>
                  })}
                </div>
              </article>

              {Object.keys(byMistake).length > 0 && (
                <article className={styles.panel}>
                  <div className={styles.panelHeader}><span className={styles.panelTitle}>Mistake cost analysis</span></div>
                  <div className={styles.mistakeList}>
                    {Object.entries(byMistake).sort((a, b) => a[1].pnl - b[1].pnl).map(([name, d]) => (
                      <div className={styles.mistakeRow} key={name}>
                        <span>{name}</span><span>{d.count}×</span><strong className={d.pnl <= 0 ? styles.red : styles.green}>{money(d.pnl)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              )}

              <article className={`${styles.panel} ${styles.widePanel}`}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Trading calendar</span></div>
                <CalendarView trades={trades} />
              </article>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
