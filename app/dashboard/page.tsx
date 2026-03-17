'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '../components/Sidebar'
import styles from './dashboard.module.css'

const FIRMS = [
  { name: 'Apex Trader Funding', target: 6, drawdown: 6, daily: 1.5 },
  { name: 'Topstep', target: 6, drawdown: 5, daily: 2 },
  { name: 'FTMO', target: 10, drawdown: 10, daily: 5 },
  { name: 'MyFundedFutures', target: 8, drawdown: 5, daily: 2 },
  { name: 'Take Profit Trader', target: 6, drawdown: 3, daily: 1.5 },
  { name: 'Custom', target: 0, drawdown: 0, daily: 0 },
]

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showPropModal, setShowPropModal] = useState(false)
  const [challenges, setChallenges] = useState<any[]>([])
  const [showAddChallenge, setShowAddChallenge] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedFirm, setSelectedFirm] = useState(FIRMS[0])
  const [form, setForm] = useState({
    firm_name: FIRMS[0].name,
    account_size: '',
    profit_target: '',
    max_drawdown: '',
    daily_loss_limit: '',
    current_balance: '',
  })

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      fetchTrades(user.id)
      fetchChallenges(user.id)
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

  const fetchChallenges = async (userId: string) => {
    const { data } = await supabase
      .from('prop_challenges')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setChallenges(data || [])
  }

  const handleFirmSelect = (firmName: string) => {
    const firm = FIRMS.find(f => f.name === firmName) || FIRMS[0]
    setSelectedFirm(firm)
    const size = parseFloat(form.account_size) || 0
    setForm(prev => ({
      ...prev,
      firm_name: firmName,
      profit_target: firm.name !== 'Custom' && size ? (size * firm.target / 100).toFixed(2) : '',
      max_drawdown: firm.name !== 'Custom' && size ? (size * firm.drawdown / 100).toFixed(2) : '',
      daily_loss_limit: firm.name !== 'Custom' && size ? (size * firm.daily / 100).toFixed(2) : '',
    }))
  }

  const handleAccountSize = (val: string) => {
    const size = parseFloat(val) || 0
    setForm(prev => ({
      ...prev,
      account_size: val,
      profit_target: selectedFirm.name !== 'Custom' && size ? (size * selectedFirm.target / 100).toFixed(2) : prev.profit_target,
      max_drawdown: selectedFirm.name !== 'Custom' && size ? (size * selectedFirm.drawdown / 100).toFixed(2) : prev.max_drawdown,
      daily_loss_limit: selectedFirm.name !== 'Custom' && size ? (size * selectedFirm.daily / 100).toFixed(2) : prev.daily_loss_limit,
    }))
  }

  const handleSaveChallenge = async () => {
    if (!user) return
    setSaving(true)
    const size = parseFloat(form.account_size)
    const { error } = await supabase.from('prop_challenges').insert([{
      user_id: user.id,
      firm_name: form.firm_name,
      account_size: size,
      profit_target: parseFloat(form.profit_target),
      max_drawdown: parseFloat(form.max_drawdown),
      daily_loss_limit: parseFloat(form.daily_loss_limit),
      current_balance: parseFloat(form.current_balance) || size,
      starting_balance: size,
      status: 'active',
    }])
    if (!error) {
      fetchChallenges(user.id)
      setShowAddChallenge(false)
      setForm({ firm_name: FIRMS[0].name, account_size: '', profit_target: '', max_drawdown: '', daily_loss_limit: '', current_balance: '' })
    }
    setSaving(false)
  }

  const handleUpdateBalance = async (id: string, newBalance: number) => {
    await supabase.from('prop_challenges').update({ current_balance: newBalance }).eq('id', id)
    fetchChallenges(user.id)
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    await supabase.from('prop_challenges').update({ status }).eq('id', id)
    fetchChallenges(user.id)
  }

  const handleDeleteChallenge = async (id: string) => {
    await supabase.from('prop_challenges').delete().eq('id', id)
    fetchChallenges(user.id)
  }

  const closed = trades.filter(t => !t.is_open && t.pnl != null)
  const winners = closed.filter(t => t.pnl > 0)
  const losers = closed.filter(t => t.pnl < 0)
  const totalPnl = closed.reduce((s, t) => s + t.pnl, 0)
  const winRate = closed.length > 0 ? Math.round((winners.length / closed.length) * 100) : 0
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length) : 0
  const profitFactor = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '—'

  const sorted = [...closed].sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime())
  let cum = 0
  const equityCurve = sorted.map(t => { cum += t.pnl; return cum })
  const maxEq = Math.max(...equityCurve.map(Math.abs), 1)

  const bySetup: Record<string, { pnl: number; count: number; wins: number }> = {}
  closed.forEach(t => {
    const k = t.setup_tag || 'Untagged'
    if (!bySetup[k]) bySetup[k] = { pnl: 0, count: 0, wins: 0 }
    bySetup[k].pnl += t.pnl
    bySetup[k].count++
    if (t.pnl > 0) bySetup[k].wins++
  })
  const topSetups = Object.entries(bySetup).sort((a, b) => b[1].pnl - a[1].pnl).slice(0, 4)
  const maxSetupPnl = Math.max(...topSetups.map(s => Math.abs(s[1].pnl)), 1)

  const dayMap: Record<string, number> = {}
  closed.forEach(t => {
    const d = new Date(t.entry_time).toDateString()
    dayMap[d] = (dayMap[d] || 0) + t.pnl
  })
  const recentDays = Object.entries(dayMap)
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .slice(0, 14).reverse()

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

      {/* Prop Firm Modal */}
      {showPropModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPropModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>🏆 Prop Firm Tracker</h2>
              <button onClick={() => setShowPropModal(false)} className={styles.modalClose}>✕</button>
            </div>

            {/* Active Challenges */}
            {challenges.length > 0 && (
              <div className={styles.challengesList}>
                {challenges.map(c => {
                  const profit = c.current_balance - c.starting_balance
                  const profitPct = (profit / c.account_size) * 100
                  const drawdownPct = ((c.starting_balance - c.current_balance) / c.account_size) * 100
                  const targetPct = (c.profit_target / c.account_size) * 100
                  const drawdownLimitPct = (c.max_drawdown / c.account_size) * 100
                  const profitProgress = Math.min((profit / c.profit_target) * 100, 100)
                  const drawdownProgress = Math.min((Math.max(0, -profit) / c.max_drawdown) * 100, 100)
                  const isPassing = profit >= 0
                  const hasFailed = drawdownProgress >= 100
                  const hasPassed = profitProgress >= 100

                  return (
                    <div key={c.id} className={`${styles.challengeCard} ${hasFailed ? styles.challengeFailed : hasPassed ? styles.challengePassed : ''}`}>
                      <div className={styles.challengeHeader}>
                        <div>
                          <span className={styles.challengeFirm}>{c.firm_name}</span>
                          <span className={styles.challengeSize}>${c.account_size.toLocaleString()} account</span>
                        </div>
                        <div className={styles.challengeHeaderRight}>
                          <span className={`${styles.challengeStatus} ${hasFailed ? styles.statusFailed : hasPassed ? styles.statusPassed : styles.statusActive}`}>
                            {hasFailed ? '❌ FAILED' : hasPassed ? '✅ PASSED' : '🔄 ACTIVE'}
                          </span>
                          <button onClick={() => handleDeleteChallenge(c.id)} className={styles.challengeDeleteBtn}>✕</button>
                        </div>
                      </div>

                      {/* Profit Progress */}
                      <div className={styles.challengeMetric}>
                        <div className={styles.challengeMetricTop}>
                          <span className={styles.challengeMetricLabel}>Profit Target</span>
                          <span className={`${styles.challengeMetricValue} ${profit >= 0 ? styles.green : styles.red}`}>
                            {profit >= 0 ? '+' : ''}${profit.toFixed(2)} / ${c.profit_target.toLocaleString()}
                          </span>
                        </div>
                        <div className={styles.challengeBar}>
                          <div
                            className={`${styles.challengeBarFill} ${styles.barGreen}`}
                            style={{ width: `${Math.max(0, profitProgress)}%` }}
                          />
                        </div>
                        <span className={styles.challengeMetricSub}>
                          {profitProgress.toFixed(1)}% of target reached
                        </span>
                      </div>

                      {/* Drawdown */}
                      <div className={styles.challengeMetric}>
                        <div className={styles.challengeMetricTop}>
                          <span className={styles.challengeMetricLabel}>Max Drawdown</span>
                          <span className={`${styles.challengeMetricValue} ${drawdownProgress > 75 ? styles.red : styles.green}`}>
                            ${Math.max(0, -profit).toFixed(2)} / ${c.max_drawdown.toLocaleString()}
                          </span>
                        </div>
                        <div className={styles.challengeBar}>
                          <div
                            className={`${styles.challengeBarFill} ${drawdownProgress > 75 ? styles.barRed : drawdownProgress > 50 ? styles.barAmber : styles.barGreen}`}
                            style={{ width: `${drawdownProgress}%` }}
                          />
                        </div>
                        <span className={styles.challengeMetricSub}>
                          {drawdownProgress.toFixed(1)}% of max drawdown used
                        </span>
                      </div>

                      {/* Update Balance */}
                      <div className={styles.challengeUpdate}>
                        <span className={styles.challengeMetricLabel}>Update Current Balance</span>
                        <div className={styles.challengeUpdateRow}>
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={c.current_balance}
                            className={styles.challengeInput}
                            id={`balance-${c.id}`}
                            placeholder="Current balance"
                          />
                          <button
                            onClick={() => {
                              const input = document.getElementById(`balance-${c.id}`) as HTMLInputElement
                              handleUpdateBalance(c.id, parseFloat(input.value))
                            }}
                            className={styles.challengeUpdateBtn}
                          >
                            Update
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add Challenge Form */}
            {showAddChallenge ? (
              <div className={styles.addChallengeForm}>
                <h3 className={styles.addChallengeTitle}>Add New Challenge</h3>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Prop Firm</label>
                  <select
                    value={form.firm_name}
                    onChange={e => handleFirmSelect(e.target.value)}
                    className={styles.formSelect}
                  >
                    {FIRMS.map(f => <option key={f.name}>{f.name}</option>)}
                  </select>
                </div>

                <div className={styles.formGrid2}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Account Size ($)</label>
                    <input
                      type="number"
                      placeholder="e.g. 50000"
                      value={form.account_size}
                      onChange={e => handleAccountSize(e.target.value)}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Current Balance ($)</label>
                    <input
                      type="number"
                      placeholder="Same as account size if just starting"
                      value={form.current_balance}
                      onChange={e => setForm(prev => ({ ...prev, current_balance: e.target.value }))}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formGrid3}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Profit Target ($)</label>
                    <input
                      type="number"
                      placeholder="e.g. 3000"
                      value={form.profit_target}
                      onChange={e => setForm(prev => ({ ...prev, profit_target: e.target.value }))}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Max Drawdown ($)</label>
                    <input
                      type="number"
                      placeholder="e.g. 3000"
                      value={form.max_drawdown}
                      onChange={e => setForm(prev => ({ ...prev, max_drawdown: e.target.value }))}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Daily Loss Limit ($)</label>
                    <input
                      type="number"
                      placeholder="e.g. 750"
                      value={form.daily_loss_limit}
                      onChange={e => setForm(prev => ({ ...prev, daily_loss_limit: e.target.value }))}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button onClick={() => setShowAddChallenge(false)} className={styles.btnGhost}>Cancel</button>
                  <button onClick={handleSaveChallenge} className={styles.btnPrimary} disabled={saving}>
                    {saving ? 'Saving...' : '💾 Save Challenge'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddChallenge(true)} className={styles.addChallengeBtn}>
                + Add New Challenge
              </button>
            )}
          </div>
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <span className={styles.pageTitle}>Dashboard</span>
            <span className={styles.pageDate}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setShowPropModal(true)} className={styles.btnPropFirm}>
              🏆 Prop Firm
              {challenges.filter(c => {
                const profit = c.current_balance - c.starting_balance
                const drawdownProgress = Math.max(0, -profit) / c.max_drawdown * 100
                return drawdownProgress > 75
              }).length > 0 && <span className={styles.alertDot} />}
            </button>
            <Link href="/dashboard/add-trade" className={styles.btnPrimary}>+ Log Trade</Link>
          </div>
        </div>

        <div className={styles.content}>
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

          <div className={styles.twoCol}>
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