'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '../../components/Sidebar'
import styles from './analytics.module.css'

function CalendarView({ trades }: { trades: any[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button onClick={prevMonth} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '14px' }}>←</button>
        <span style={{ fontSize: '15px', fontWeight: '700' }}>
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={nextMonth} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '14px' }}>→</button>
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
                background: hasTradesWon ? 'rgba(0,212,170,0.12)' : hasTradesLost ? 'rgba(255,71,87,0.1)' : 'var(--bg-secondary)',
                border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
                color: hasTradesWon ? 'var(--accent-green)' : hasTradesLost ? 'var(--accent-red)' : 'var(--text-muted)',
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
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .eq('is_open', false)
      .not('pnl', 'is', null)
    setTrades(data || [])
    setLoading(false)
  }

  const winners = trades.filter(t => t.pnl > 0)
  const losers = trades.filter(t => t.pnl < 0)
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0
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
  const equityCurve = sorted.map(t => { cum += t.pnl; return { date: new Date(t.entry_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: cum } })

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

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const byDay: Record<string, { pnl: number; count: number }> = {}
  days.forEach(d => { byDay[d] = { pnl: 0, count: 0 } })
  trades.forEach(t => {
    const day = days[new Date(t.entry_time).getDay()]
    byDay[day].pnl += t.pnl
    byDay[day].count++
  })

  const byMistake: Record<string, { pnl: number; count: number }> = {}
  trades.filter(t => t.mistake_tag).forEach(t => {
    if (!byMistake[t.mistake_tag]) byMistake[t.mistake_tag] = { pnl: 0, count: 0 }
    byMistake[t.mistake_tag].pnl += t.pnl
    byMistake[t.mistake_tag].count++
  })

  const maxBar = (vals: number[]) => Math.max(...vals.map(Math.abs), 1)

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p>Crunching your numbers...</p>
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <Sidebar userEmail={user?.email || ''} />
      <main className={styles.main}>

        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <span className={styles.pageTitle}>Analytics</span>
            <span className={styles.pageSubtitle}>Based on {trades.length} closed trades</span>
          </div>
        </div>

        {trades.length === 0 ? (
          <div className={styles.content}>
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📈</span>
              <h3>No closed trades yet</h3>
              <p>Log some trades to unlock your analytics</p>
              <Link href="/dashboard/add-trade" className={styles.btnPrimary}>+ Log Trade</Link>
            </div>
          </div>
        ) : (
          <div className={styles.content}>

            {/* Hero Stats */}
            <div className={styles.heroStats}>
              {[
                { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, sub: `${winners.length}W / ${losers.length}L`, color: totalPnl >= 0 ? 'green' : 'red', accent: totalPnl >= 0 ? 'accentGreen' : 'accentRed' },
                { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, sub: `${trades.length} total trades`, color: winRate >= 50 ? 'green' : 'red', accent: winRate >= 50 ? 'accentGreen' : 'accentRed' },
                { label: 'Profit Factor', value: profitFactor > 0 ? profitFactor.toFixed(2) : '—', sub: 'Avg win / avg loss', color: profitFactor >= 1.5 ? 'green' : profitFactor >= 1 ? 'amber' : 'red', accent: 'accentPurple' },
                { label: 'Expectancy', value: `$${expectancy.toFixed(2)}`, sub: 'Per trade average', color: expectancy >= 0 ? 'green' : 'red', accent: expectancy >= 0 ? 'accentGreen' : 'accentRed' },
              ].map((s, i) => (
                <div key={i} className={styles.heroStat}>
                  <div className={`${styles.heroStatAccent} ${styles[s.accent]}`} />
                  <span className={styles.heroStatLabel}>{s.label}</span>
                  <span className={`${styles.heroStatValue} ${styles[s.color]}`}>{s.value}</span>
                  <span className={styles.heroStatSub}>{s.sub}</span>
                </div>
              ))}
            </div>

            {/* Secondary Stats */}
            <div className={styles.secondaryStats}>
              {[
                { label: 'Avg Winner', value: `$${avgWin.toFixed(2)}`, color: 'green' },
                { label: 'Avg Loser', value: `-$${avgLoss.toFixed(2)}`, color: 'red' },
                { label: 'Best Trade', value: `+$${bestTrade.toFixed(2)}`, color: 'green' },
                { label: 'Worst Trade', value: `$${worstTrade.toFixed(2)}`, color: 'red' },
                { label: 'Max Consec. Wins', value: `${maxConsecWins}`, color: 'green' },
                { label: 'Max Consec. Losses', value: `${maxConsecLosses}`, color: 'red' },
                { label: 'Total Trades', value: `${trades.length}`, color: 'neutral' },
                { label: 'Winners / Losers', value: `${winners.length} / ${losers.length}`, color: 'neutral' },
              ].map((s, i) => (
                <div key={i} className={styles.secondaryStat}>
                  <span className={styles.secondaryStatLabel}>{s.label}</span>
                  <span className={`${styles.secondaryStatValue} ${styles[s.color]}`}>{s.value}</span>
                </div>
              ))}
            </div>

            {/* Equity Curve */}
            {equityCurve.length > 1 && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>Equity Curve</span>
                  <span className={`${styles.cardBadge} ${totalPnl >= 0 ? styles.green : styles.red}`}>
                    {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} total
                  </span>
                </div>
                <div className={styles.equityWrap}>
                  <div className={styles.equityCurve}>
                    {equityCurve.map((p, i) => {
                      const max = Math.max(...equityCurve.map(x => Math.abs(x.value)), 1)
                      const h = Math.abs(p.value) / max * 100
                      return (
                        <div key={i} className={styles.equityBar} title={`${p.date}: $${p.value.toFixed(2)}`}>
                          <div className={`${styles.equityBarFill} ${p.value >= 0 ? styles.equityBarGreen : styles.equityBarRed}`} style={{ height: `${h}%` }} />
                        </div>
                      )
                    })}
                  </div>
                  <div className={styles.equityLabels}>
                    <span>{equityCurve[0]?.date}</span>
                    <span>{equityCurve[equityCurve.length - 1]?.date}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Instrument + Setup side by side */}
            <div className={styles.twoCol}>
              {Object.keys(byInstrument).length > 0 && (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>By Instrument</span>
                  </div>
                  <div className={styles.breakdownTable}>
                    <div className={styles.breakdownHead}>
                      <span>Instrument</span><span>Trades</span><span>WR</span><span>P&L</span><span>Bar</span>
                    </div>
                    {Object.entries(byInstrument).sort((a, b) => b[1].pnl - a[1].pnl).map(([inst, data]) => {
                      const wr = Math.round((data.wins / data.count) * 100)
                      const bw = Math.abs(data.pnl) / maxBar(Object.values(byInstrument).map(d => d.pnl)) * 100
                      return (
                        <div key={inst} className={styles.breakdownRow}>
                          <span className={styles.breakdownName}>{inst}</span>
                          <span>{data.count}</span>
                          <span className={wr >= 50 ? styles.green : styles.red}>{wr}%</span>
                          <span className={data.pnl >= 0 ? styles.green : styles.red}>{data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(0)}</span>
                          <span className={styles.barCell}><div className={`${styles.bar} ${data.pnl >= 0 ? styles.barGreen : styles.barRed}`} style={{ width: `${bw}%` }} /></span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {Object.keys(bySetup).length > 0 && (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>By Setup</span>
                  </div>
                  <div className={styles.breakdownTable}>
                    <div className={styles.breakdownHead}>
                      <span>Setup</span><span>Trades</span><span>WR</span><span>P&L</span><span>Bar</span>
                    </div>
                    {Object.entries(bySetup).sort((a, b) => b[1].pnl - a[1].pnl).map(([setup, data]) => {
                      const wr = Math.round((data.wins / data.count) * 100)
                      const bw = Math.abs(data.pnl) / maxBar(Object.values(bySetup).map(d => d.pnl)) * 100
                      return (
                        <div key={setup} className={styles.breakdownRow}>
                          <span className={styles.breakdownName}>{setup}</span>
                          <span>{data.count}</span>
                          <span className={wr >= 50 ? styles.green : styles.red}>{wr}%</span>
                          <span className={data.pnl >= 0 ? styles.green : styles.red}>{data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(0)}</span>
                          <span className={styles.barCell}><div className={`${styles.bar} ${data.pnl >= 0 ? styles.barGreen : styles.barRed}`} style={{ width: `${bw}%` }} /></span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Day of Week */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Performance by Day</span>
              </div>
              <div className={styles.dayGrid}>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                  const data = byDay[day]
                  return (
                    <div key={day} className={styles.dayCard}>
                      <span className={styles.dayName}>{day.slice(0, 3)}</span>
                      <span className={`${styles.dayPnl} ${data.pnl > 0 ? styles.green : data.pnl < 0 ? styles.red : styles.muted}`}>
                        {data.count > 0 ? `${data.pnl >= 0 ? '+' : ''}$${data.pnl.toFixed(0)}` : '—'}
                      </span>
                      <span className={styles.dayCount}>{data.count} trades</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Mistake Analysis */}
            {Object.keys(byMistake).length > 0 && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>Mistake Cost Analysis</span>
                  <span className={styles.cardBadge}>{Object.keys(byMistake).length} mistake types</span>
                </div>
                <div className={styles.breakdownTable}>
                  <div className={styles.breakdownHead}>
                    <span>Mistake</span><span>Times</span><span>Total Cost</span><span>Avg Cost</span>
                  </div>
                  {Object.entries(byMistake).sort((a, b) => a[1].pnl - b[1].pnl).map(([mistake, data]) => (
                    <div key={mistake} className={styles.breakdownRow}>
                      <span><span className={styles.mistakeTag}>{mistake}</span></span>
                      <span>{data.count}×</span>
                      <span className={styles.red}>${data.pnl.toFixed(2)}</span>
                      <span className={styles.red}>${(data.pnl / data.count).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Trading Calendar */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Trading Calendar</span>
            </div>
            <CalendarView trades={trades} />
          </div>

          </div>
        )}
      </main>
    </div>
  )
}