'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import styles from './risk.module.css'

export default function RiskRules() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [rules, setRules] = useState<any>(null)
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    daily_loss_limit: '',
    weekly_loss_limit: '',
    max_contracts: '',
    max_trades_per_day: '',
  })

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      fetchData(user.id)
    }
    getUser()
  }, [])

  const fetchData = async (userId: string) => {
    const [{ data: rulesData }, { data: tradeData }] = await Promise.all([
      supabase.from('risk_rules').select('*').eq('user_id', userId).single(),
      supabase.from('trades').select('*').eq('user_id', userId).not('pnl', 'is', null),
    ])
    if (rulesData) {
      setRules(rulesData)
      setForm({
        daily_loss_limit: rulesData.daily_loss_limit?.toString() || '',
        weekly_loss_limit: rulesData.weekly_loss_limit?.toString() || '',
        max_contracts: rulesData.max_contracts?.toString() || '',
        max_trades_per_day: rulesData.max_trades_per_day?.toString() || '',
      })
    }
    setTrades(tradeData || [])
    setLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    const payload = {
      user_id: user.id,
      daily_loss_limit: form.daily_loss_limit ? parseFloat(form.daily_loss_limit) : null,
      weekly_loss_limit: form.weekly_loss_limit ? parseFloat(form.weekly_loss_limit) : null,
      max_contracts: form.max_contracts ? parseInt(form.max_contracts) : null,
      max_trades_per_day: form.max_trades_per_day ? parseInt(form.max_trades_per_day) : null,
    }
    if (rules) {
      await supabase.from('risk_rules').update(payload).eq('id', rules.id)
    } else {
      await supabase.from('risk_rules').insert([payload])
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    fetchData(user.id)
  }

  // Today
  const today = new Date().toDateString()
  const todayTrades = trades.filter(t => new Date(t.entry_time).toDateString() === today)
  const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0)
  const todayLoss = Math.min(todayPnl, 0)

  // This week
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const weekTrades = trades.filter(t => new Date(t.entry_time) >= startOfWeek)
  const weekPnl = weekTrades.reduce((s, t) => s + (t.pnl || 0), 0)
  const weekLoss = Math.min(weekPnl, 0)

  const dailyLimitSet = form.daily_loss_limit !== ''
  const weeklyLimitSet = form.weekly_loss_limit !== ''
  const maxTradesSet = form.max_trades_per_day !== ''
  const dailyLossLimit = parseFloat(form.daily_loss_limit) || 0
  const weeklyLossLimit = parseFloat(form.weekly_loss_limit) || 0
  const maxTradesPerDay = parseInt(form.max_trades_per_day) || 0

  const dailyBreached = dailyLimitSet && Math.abs(todayLoss) >= dailyLossLimit
  const weeklyBreached = weeklyLimitSet && Math.abs(weekLoss) >= weeklyLossLimit
  const tradesBreached = maxTradesSet && todayTrades.length >= maxTradesPerDay

  const dailyProgress = dailyLimitSet && dailyLossLimit > 0
    ? Math.min((Math.abs(todayLoss) / dailyLossLimit) * 100, 100) : 0
  const weeklyProgress = weeklyLimitSet && weeklyLossLimit > 0
    ? Math.min((Math.abs(weekLoss) / weeklyLossLimit) * 100, 100) : 0
  const tradesProgress = maxTradesSet && maxTradesPerDay > 0
    ? Math.min((todayTrades.length / maxTradesPerDay) * 100, 100) : 0

  const getBarColor = (pct: number) => {
    if (pct >= 100) return styles.barRed
    if (pct >= 75) return styles.barAmber
    return styles.barGreen
  }

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p>Loading risk rules...</p>
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <Sidebar userEmail={user?.email || ''} />

      <main className={styles.main}>
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <span className={styles.pageTitle}>Risk Rules</span>
            <span className={styles.pageSubtitle}>Set your limits. Protect your account.</span>
          </div>
        </div>

        <div className={styles.content}>

          {/* Breach Alert */}
          {(dailyBreached || weeklyBreached || tradesBreached) && (
            <div className={styles.alertBox}>
              <span className={styles.alertIcon}>🚨</span>
              <div>
                <p className={styles.alertTitle}>Rule Limit Reached — Stop Trading Now!</p>
                <p className={styles.alertText}>
                  {dailyBreached && `Daily loss limit of $${dailyLossLimit} has been hit. `}
                  {weeklyBreached && `Weekly loss limit of $${weeklyLossLimit} has been hit. `}
                  {tradesBreached && `Max trades per day (${maxTradesPerDay}) has been reached. `}
                  Close your platform and walk away. Come back tomorrow.
                </p>
              </div>
            </div>
          )}

          <div className={styles.twoCol}>

            {/* Rules Form */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>⚙️ Your Rules</h2>
              </div>
              <form onSubmit={handleSave} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label}>Daily Loss Limit ($)</label>
                  <p className={styles.fieldHint}>Stop trading for the day if you lose this much</p>
                  <input name="daily_loss_limit" type="number" step="0.01" min="0" placeholder="e.g. 500" value={form.daily_loss_limit} onChange={handleChange} className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Weekly Loss Limit ($)</label>
                  <p className={styles.fieldHint}>Stop trading for the week if you hit this</p>
                  <input name="weekly_loss_limit" type="number" step="0.01" min="0" placeholder="e.g. 1500" value={form.weekly_loss_limit} onChange={handleChange} className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Max Contracts Per Trade</label>
                  <p className={styles.fieldHint}>Hard cap on position size</p>
                  <input name="max_contracts" type="number" min="1" placeholder="e.g. 5" value={form.max_contracts} onChange={handleChange} className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Max Trades Per Day</label>
                  <p className={styles.fieldHint}>Stop when you hit this number</p>
                  <input name="max_trades_per_day" type="number" min="1" placeholder="e.g. 6" value={form.max_trades_per_day} onChange={handleChange} className={styles.input} />
                </div>

                {/* Rules preview chips */}
                {(form.daily_loss_limit || form.weekly_loss_limit || form.max_contracts || form.max_trades_per_day) && (
                  <div className={styles.rulesPreview}>
                    {form.daily_loss_limit && (
                      <div className={styles.ruleChip}>
                        <span className={styles.ruleChipLabel}>Daily limit</span>
                        <span className={styles.ruleChipValue}>${parseFloat(form.daily_loss_limit).toLocaleString()}</span>
                      </div>
                    )}
                    {form.weekly_loss_limit && (
                      <div className={styles.ruleChip}>
                        <span className={styles.ruleChipLabel}>Weekly limit</span>
                        <span className={styles.ruleChipValue}>${parseFloat(form.weekly_loss_limit).toLocaleString()}</span>
                      </div>
                    )}
                    {form.max_contracts && (
                      <div className={styles.ruleChip}>
                        <span className={styles.ruleChipLabel}>Max contracts</span>
                        <span className={styles.ruleChipValue}>{form.max_contracts}</span>
                      </div>
                    )}
                    {form.max_trades_per_day && (
                      <div className={styles.ruleChip}>
                        <span className={styles.ruleChipLabel}>Max trades/day</span>
                        <span className={styles.ruleChipValue}>{form.max_trades_per_day}</span>
                      </div>
                    )}
                  </div>
                )}

                <button type="submit" className={styles.btnPrimary} disabled={saving}>
                  {saving ? 'Saving...' : saved ? '✓ Rules Saved!' : '💾 Save Rules'}
                </button>
              </form>
            </div>

            {/* Right column */}
            <div className={styles.statusCol}>

              {/* Live Status */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>📊 Live Status</h2>
                </div>
                <div className={styles.statusList}>
                  {dailyLimitSet ? (
                    <div className={styles.statusItem}>
                      <div className={styles.statusTop}>
                        <span className={styles.statusLabel}>Daily Loss</span>
                        <span className={`${styles.statusValue} ${dailyBreached ? styles.red : styles.green}`}>
                          ${Math.abs(todayLoss).toFixed(2)} / ${dailyLossLimit}
                        </span>
                      </div>
                      <div className={styles.progressTrack}>
                        <div className={`${styles.progressBar} ${getBarColor(dailyProgress)}`} style={{ width: `${dailyProgress}%` }} />
                      </div>
                      <span className={styles.statusHint}>
                        {dailyBreached ? '🚨 Limit reached — stop trading!' : `$${(dailyLossLimit - Math.abs(todayLoss)).toFixed(2)} remaining today`}
                      </span>
                    </div>
                  ) : <div className={styles.statusItemEmpty}>No daily loss limit set</div>}

                  {weeklyLimitSet ? (
                    <div className={styles.statusItem}>
                      <div className={styles.statusTop}>
                        <span className={styles.statusLabel}>Weekly Loss</span>
                        <span className={`${styles.statusValue} ${weeklyBreached ? styles.red : styles.green}`}>
                          ${Math.abs(weekLoss).toFixed(2)} / ${weeklyLossLimit}
                        </span>
                      </div>
                      <div className={styles.progressTrack}>
                        <div className={`${styles.progressBar} ${getBarColor(weeklyProgress)}`} style={{ width: `${weeklyProgress}%` }} />
                      </div>
                      <span className={styles.statusHint}>
                        {weeklyBreached ? '🚨 Limit reached — stop trading!' : `$${(weeklyLossLimit - Math.abs(weekLoss)).toFixed(2)} remaining this week`}
                      </span>
                    </div>
                  ) : <div className={styles.statusItemEmpty}>No weekly loss limit set</div>}

                  {maxTradesSet ? (
                    <div className={styles.statusItem}>
                      <div className={styles.statusTop}>
                        <span className={styles.statusLabel}>Trades Today</span>
                        <span className={`${styles.statusValue} ${tradesBreached ? styles.red : styles.green}`}>
                          {todayTrades.length} / {maxTradesPerDay}
                        </span>
                      </div>
                      <div className={styles.progressTrack}>
                        <div className={`${styles.progressBar} ${getBarColor(tradesProgress)}`} style={{ width: `${tradesProgress}%` }} />
                      </div>
                      <span className={styles.statusHint}>
                        {tradesBreached ? '🚨 Max trades reached!' : `${maxTradesPerDay - todayTrades.length} trades left today`}
                      </span>
                    </div>
                  ) : <div className={styles.statusItemEmpty}>No trade limit set</div>}
                </div>
              </div>

              {/* Today Summary */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>📅 Today</h2>
                </div>
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>P&L</span>
                    <span className={`${styles.summaryValue} ${todayPnl >= 0 ? styles.green : styles.red}`}>
                      {todayPnl >= 0 ? '+' : ''}${todayPnl.toFixed(2)}
                    </span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Trades</span>
                    <span className={styles.summaryValue}>{todayTrades.length}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Winners</span>
                    <span className={`${styles.summaryValue} ${styles.green}`}>
                      {todayTrades.filter(t => t.pnl > 0).length}
                    </span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Losers</span>
                    <span className={`${styles.summaryValue} ${styles.red}`}>
                      {todayTrades.filter(t => t.pnl < 0).length}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  )
}