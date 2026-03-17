'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '../components/Sidebar'
import styles from './dashboard.module.css'

export default function Dashboard() {
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
      .order('entry_time', { ascending: false })
    setTrades(data || [])
    setLoading(false)
  }

  const closed = trades.filter(t => !t.is_open && t.pnl != null)
  const winners = closed.filter(t => t.pnl > 0)
  const losers = closed.filter(t => t.pnl < 0)
  const totalPnl = closed.reduce((s, t) => s + t.pnl, 0)
  const winRate = closed.length > 0 ? Math.round((winners.length / closed.length) * 100) : 0
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length) : 0
  const profitFactor = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '—'

  // Equity curve for mini chart
  const sorted = [...closed].sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime())
  let cum = 0
  const equityCurve = sorted.map(t => { cum += t.pnl; return cum })
  const maxEq = Math.max(...equityCurve.map(Math.abs), 1)

  // Top setups
  const bySetup: Record<string, { pnl: number; count: number; wins: number }> = {}
  closed.forEach(t => {
    const k = t.setup_tag || 'Untagged'
    if (!bySetup[k]) bySetup[k] = { pnl: 0, count: 0, wins: 0 }
    bySetup[k].pnl += t.pnl
    bySetup[k].count++
    if (t.pnl > 0) bySetup[k].wins++
  })
  const topSetups = Object.entries(bySetup)
    .sort((a, b) => b[1].pnl - a[1].pnl)
    .slice(0, 4)
  const maxSetupPnl = Math.max(...topSetups.map(s => Math.abs(s[1].pnl)), 1)

  // Last 10 trading days streak
  const dayMap: Record<string, number> = {}
  closed.forEach(t => {
    const d = new Date(t.entry_time).toDateString()
    dayMap[d] = (dayMap[d] || 0) + t.pnl
  })
  const recentDays = Object.entries(dayMap)
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .slice(0, 14)
    .reverse()

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p>Loading your journal...</p>
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <Sidebar userEmail={user?.email || ''} />
      <main className={styles.main}>

        {/* Top Bar */}
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <span className={styles.pageTitle}>Dashboard</span>
            <span className={styles.pageDate}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <Link href="/dashboard/add-trade" className={styles.btnPrimary}>+ Log Trade</Link>
        </div>

        <div className={styles.content}>

          {/* P&L Hero */}
          <div className={styles.pnlHero}>
            <div className={styles.pnlHeroLeft}>
              <span className={styles.pnlHeroLabel}>All Time P&L</span>
              <span className={`${styles.pnlHeroValue} ${totalPnl >= 0 ? styles.green : styles.red}`}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </span>
              <span className={styles.pnlHeroSub}>{closed.length} closed trades recorded</span>
            </div>
            <div className={styles.pnlHeroRight}>
              <div className={styles.pnlHeroStat}>
                <span className={`${styles.pnlHeroStatValue} ${winRate >= 50 ? styles.green : styles.red}`}>{winRate}%</span>
                <span className={styles.pnlHeroStatLabel}>Win Rate</span>
              </div>
              <div className={styles.pnlHeroDivider} />
              <div className={styles.pnlHeroStat}>
                <span className={styles.pnlHeroStatValue}>{profitFactor}</span>
                <span className={styles.pnlHeroStatLabel}>Profit Factor</span>
              </div>
              <div className={styles.pnlHeroDivider} />
              <div className={styles.pnlHeroStat}>
                <span className={`${styles.pnlHeroStatValue} ${styles.green}`}>{winners.length}</span>
                <span className={styles.pnlHeroStatLabel}>Winners</span>
              </div>
              <div className={styles.pnlHeroDivider} />
              <div className={styles.pnlHeroStat}>
                <span className={`${styles.pnlHeroStatValue} ${styles.red}`}>{losers.length}</span>
                <span className={styles.pnlHeroStatLabel}>Losers</span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className={styles.statsGrid}>
            {[
              { icon: '💰', label: 'Avg Winner', value: `$${avgWin.toFixed(2)}`, sub: 'Per winning trade', color: 'green' },
              { icon: '📉', label: 'Avg Loser', value: `-$${avgLoss.toFixed(2)}`, sub: 'Per losing trade', color: 'red' },
              { icon: '📊', label: 'Total Trades', value: `${trades.length}`, sub: `${trades.filter(t => t.is_open).length} still open`, color: '' },
              { icon: '🏆', label: 'Best Trade', value: closed.length > 0 ? `+$${Math.max(...closed.map(t => t.pnl)).toFixed(2)}` : '—', sub: 'All time high', color: 'green' },
            ].map((s, i) => (
              <div key={i} className={styles.statCard}>
                <span className={styles.statIcon}>{s.icon}</span>
                <span className={styles.statLabel}>{s.label}</span>
                <span className={`${styles.statValue} ${s.color ? styles[s.color] : ''}`}>{s.value}</span>
                <span className={styles.statSub}>{s.sub}</span>
              </div>
            ))}
          </div>

          {/* Two col: equity curve + top setups */}
          <div className={styles.twoCol}>

            {/* Equity Curve */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionLabel}>Equity Curve</span>
                <Link href="/dashboard/analytics" className={styles.seeAll}>Full analytics →</Link>
              </div>
              {equityCurve.length > 1 ? (
                <div className={styles.miniChart}>
                  {equityCurve.map((v, i) => (
                    <div
                      key={i}
                      className={`${styles.miniBar} ${v >= 0 ? styles.miniBarGreen : styles.miniBarRed}`}
                      style={{ height: `${Math.abs(v) / maxEq * 100}%` }}
                      title={`$${v.toFixed(2)}`}
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>📈</span>
                  <p>Log trades to see your equity curve</p>
                </div>
              )}
            </div>

            {/* Top Setups */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionLabel}>Top Setups</span>
                <Link href="/dashboard/analytics" className={styles.seeAll}>See all →</Link>
              </div>
              {topSetups.length > 0 ? (
                <div className={styles.breakdownList}>
                  {topSetups.map(([name, data]) => (
                    <div key={name} className={styles.breakdownItem}>
                      <div className={styles.breakdownTop}>
                        <span className={styles.breakdownName}>{name}</span>
                        <div className={styles.breakdownStats}>
                          <span>{data.count} trades</span>
                          <span>{Math.round(data.wins / data.count * 100)}% WR</span>
                          <span className={`${styles.breakdownPnl} ${data.pnl >= 0 ? styles.green : styles.red}`}>
                            {data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(0)}
                          </span>
                        </div>
                      </div>
                      <div className={styles.progressTrack}>
                        <div
                          className={`${styles.progressFill} ${data.pnl >= 0 ? styles.progressGreen : styles.progressRed}`}
                          style={{ width: `${Math.abs(data.pnl) / maxSetupPnl * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>📋</span>
                  <p>Tag your trades with setups to see breakdown</p>
                </div>
              )}
            </div>
          </div>

          {/* Day Streak */}
          {recentDays.length > 0 && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionLabel}>Recent Trading Days</span>
              </div>
              <div className={styles.streakRow}>
                {recentDays.map(([date, pnl], i) => (
                  <div
                    key={i}
                    className={`${styles.streakDay} ${pnl > 0 ? styles.streakWin : pnl < 0 ? styles.streakLoss : styles.streakNeutral}`}
                    title={`${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(0)}`}
                  >
                    {new Date(date).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Trades */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Recent Trades</span>
              <Link href="/dashboard/trades" className={styles.seeAll}>See all →</Link>
            </div>
            {trades.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📓</span>
                <h3>No trades yet</h3>
                <p>Log your first trade to start tracking your performance</p>
                <Link href="/dashboard/add-trade" className={styles.btnPrimary} style={{ marginTop: '8px' }}>
                  + Log First Trade
                </Link>
              </div>
            ) : (
              <div className={styles.tradesList}>
                {trades.slice(0, 8).map(trade => (
                  <div key={trade.id} className={styles.tradeRow}>
                    <span className={styles.tradeInst}>{trade.instrument}</span>
                    <span className={`${styles.tradeBadge} ${trade.direction === 'LONG' ? styles.long : styles.short}`}>
                      {trade.direction}
                    </span>
                    <span className={styles.tradeSetup}>{trade.setup_tag || 'No setup tag'}</span>
                    <span className={`${styles.tradePnl} ${trade.is_open ? styles.amber : trade.pnl > 0 ? styles.green : trade.pnl < 0 ? styles.red : ''}`}>
                      {trade.is_open ? 'OPEN' : trade.pnl != null ? `${trade.pnl > 0 ? '+' : ''}$${trade.pnl.toFixed(2)}` : '—'}
                    </span>
                    <span className={styles.tradeDate}>
                      {new Date(trade.entry_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}