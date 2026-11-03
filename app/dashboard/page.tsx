'use client'
import { useState, useEffect, useId } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Fraunces } from 'next/font/google'
import Sidebar from '../components/Sidebar'
import styles from './dashboard.module.css'

// Soft, slightly rounded serif. Used for big numbers, headings and the story line.
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['SOFT'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const FIRMS = [
  { name: 'Apex Trader Funding', target: 6, drawdown: 6, daily: 1.5 },
  { name: 'Topstep', target: 6, drawdown: 5, daily: 2 },
  { name: 'FTMO', target: 10, drawdown: 10, daily: 5 },
  { name: 'MyFundedFutures', target: 8, drawdown: 5, daily: 2 },
  { name: 'Take Profit Trader', target: 6, drawdown: 3, daily: 1.5 },
  { name: 'Custom', target: 0, drawdown: 0, daily: 0 },
]

type Trade = {
  id: string
  instrument: string
  direction?: string | null
  pnl: number | null
  entry_time: string
  is_open?: boolean
  setup_tag?: string | null
}

type Closed = Trade & { pnl: number }

type Challenge = {
  id: string
  firm_name: string
  account_size: number
  profit_target: number
  max_drawdown: number
  daily_loss_limit?: number | null
  current_balance: number
  starting_balance: number
}

type Point = { date: string; value: number; pnl: number }

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
const sum = (list: { pnl: number }[]) => list.reduce((s, t) => s + t.pnl, 0)

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

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

function EquityHero({ points, total, openCount }: { points: Point[]; total: number; openCount: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const uid = useId().replace(/:/g, '')
  const counted = useCountUp(total)

  const n = points.length
  const active = hover !== null ? points[hover] : null
  const shown = active ? active.value : counted
  const toneValue = active ? active.value : total

  const caption = active
    ? `Trade ${hover! + 1} on ${active.date}: ${signed(active.pnl)}`
    : n === 0
      ? 'Nothing closed yet'
      : `All time, across ${n} closed ${plural(n, 'trade', 'trades')}${openCount > 0 ? ` and ${openCount} still open` : ''}`

  if (n < 2) {
    return (
      <section aria-label="All time profit">
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
    <section aria-label="All time profit">
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

function SeeMore({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={styles.more}>
      {children}
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 3 5 5-5 5" />
      </svg>
    </Link>
  )
}

/* ---------- prop firm meter ---------- */

function Meter({ label, value, valueClass, sub, fill, fillClass }: {
  label: string
  value: string
  valueClass: string
  sub: string
  fill: number
  fillClass: string
}) {
  return (
    <div className={styles.meterBlock}>
      <div className={styles.meterTop}>
        <span className={styles.meterLabel}>{label}</span>
        <span className={`${styles.meterValue} ${valueClass}`}>{value}</span>
      </div>
      <div className={styles.mTrack}>
        <span className={`${styles.mFill} ${fillClass}`} style={{ width: `${fill}%` }} />
      </div>
      <span className={styles.meterSub}>{sub}</span>
    </div>
  )
}

/* ---------- page ---------- */

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [showPropModal, setShowPropModal] = useState(false)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [showAddChallenge, setShowAddChallenge] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
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
    if (!showPropModal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPropModal(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showPropModal])

  const fetchTrades = async (userId: string) => {
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('entry_time', { ascending: false })
    setTrades((data as Trade[]) || [])
    setLoading(false)
  }

  const fetchChallenges = async (userId: string) => {
    const { data } = await supabase
      .from('prop_challenges')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setChallenges((data as Challenge[]) || [])
  }

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
    if (!user || !Number.isFinite(newBalance)) return
    await supabase.from('prop_challenges').update({ current_balance: newBalance }).eq('id', id)
    fetchChallenges(user.id)
  }

  const handleDeleteChallenge = async (id: string) => {
    if (!user) return
    await supabase.from('prop_challenges').delete().eq('id', id)
    setPendingDelete(null)
    fetchChallenges(user.id)
  }

  /* --- numbers --- */
  const closed = trades.filter((t): t is Closed => !t.is_open && t.pnl != null)
  const openCount = trades.filter(t => t.is_open).length
  const winners = closed.filter(t => t.pnl > 0)
  const losers = closed.filter(t => t.pnl < 0)
  const breakevens = closed.filter(t => t.pnl === 0)
  const totalPnl = sum(closed)
  const winRate = closed.length > 0 ? ((winners.length + breakevens.length) / closed.length) * 100 : 0
  const avgWin = winners.length > 0 ? sum(winners) / winners.length : 0
  const avgLoss = losers.length > 0 ? Math.abs(sum(losers) / losers.length) : 0
  const grossLoss = Math.abs(sum(losers))
  const profitFactor = grossLoss > 0 ? sum(winners) / grossLoss : 0
  const bestTrade = closed.length > 0 ? Math.max(...closed.map(t => t.pnl)) : 0

  const sorted = [...closed].sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime())
  const equityCurve: Point[] = []
  let cum = 0
  for (const t of sorted) {
    cum += t.pnl
    equityCurve.push({
      date: new Date(t.entry_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      value: cum,
      pnl: t.pnl,
    })
  }

  /* today, this week (from Monday), this month */
  const now = new Date()
  const todayKey = now.toDateString()
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const todayList = closed.filter(t => new Date(t.entry_time).toDateString() === todayKey)
  const weekList = closed.filter(t => new Date(t.entry_time) >= weekStart)
  const monthList = closed.filter(t => new Date(t.entry_time) >= monthStart)
  const periods = [
    { label: 'Today', list: todayList },
    { label: 'This week', list: weekList },
    { label: 'This month', list: monthList },
  ]

  /* days */
  const dayMap: Record<string, number> = {}
  closed.forEach(t => {
    const d = new Date(t.entry_time).toDateString()
    dayMap[d] = (dayMap[d] || 0) + t.pnl
  })
  const daysNewestFirst = Object.entries(dayMap).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
  const recentDays = daysNewestFirst.slice(0, 14).reverse()
  const maxRecentDay = Math.max(...recentDays.map(([, v]) => Math.abs(v)), 1)

  let greenStreak = 0
  for (const [, v] of daysNewestFirst) {
    if (v > 0) greenStreak++
    else break
  }

  /* the story line under the hero */
  let story = ''
  if (todayList.length > 0) {
    story = `Today you're ${signed(sum(todayList))} across ${todayList.length} ${plural(todayList.length, 'trade', 'trades')}.`
  } else if (daysNewestFirst.length > 0) {
    const [lastKey, lastPnl] = daysNewestFirst[0]
    story = `Nothing yet today. Your last session, ${new Date(lastKey).toLocaleDateString('en-US', { weekday: 'long' })}, closed ${signed(lastPnl)}.`
  }
  if (greenStreak >= 2) story += ` That's ${greenStreak} green days in a row.`

  /* setups */
  const bySetup: Record<string, { pnl: number; count: number; wins: number }> = {}
  closed.forEach(t => {
    const k = t.setup_tag || 'Untagged'
    if (!bySetup[k]) bySetup[k] = { pnl: 0, count: 0, wins: 0 }
    bySetup[k].pnl += t.pnl
    bySetup[k].count++
    if (t.pnl > 0) bySetup[k].wins++
  })
  const setupRows: Row[] = Object.entries(bySetup)
    .sort((a, b) => b[1].pnl - a[1].pnl)
    .slice(0, 4)
    .map(([name, d]) => ({
      name,
      meta: `${d.count} ${plural(d.count, 'trade', 'trades')}, ${Math.round((d.wins / d.count) * 100)}% win rate`,
      pnl: d.pnl,
    }))

  /* prop firm alert dot */
  const hasDrawdownAlert = challenges.some(c => {
    const profit = c.current_balance - c.starting_balance
    return (Math.max(0, -profit) / c.max_drawdown) * 100 > 75
  })

  if (loading) {
    return (
      <div className={`${styles.loading} ${display.variable}`}>
        <span>Opening your journal</span>
      </div>
    )
  }

  const hasTrades = trades.length > 0

  const ledger = [
    { label: 'Win rate', value: `${winRate.toFixed(1)}%`, cls: '' },
    { label: 'Profit factor', value: profitFactor > 0 ? profitFactor.toFixed(2) : DASH, cls: '' },
    { label: 'Wins, with breakevens', value: `${winners.length + breakevens.length}`, cls: styles.gain },
    { label: 'Losses', value: `${losers.length}`, cls: losers.length > 0 ? styles.loss : '' },
    { label: 'Average winner', value: money(avgWin), cls: styles.gain },
    { label: 'Average loser', value: avgLoss > 0 ? `${MINUS}${money(avgLoss)}` : money(0), cls: avgLoss > 0 ? styles.loss : '' },
    { label: 'Best trade', value: signed(bestTrade), cls: tone(bestTrade) },
    { label: 'Trades logged', value: openCount > 0 ? `${trades.length}, ${openCount} open` : `${trades.length}`, cls: '' },
  ]

  return (
    <div className={`${styles.layout} ${display.variable}`}>
      <Sidebar userEmail={user?.email || ''} />

      {/* Prop firm tracker */}
      {showPropModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPropModal(false)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="prop-title"
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="prop-title" className={styles.modalTitle}>Prop firm tracker</h2>
              <button
                onClick={() => setShowPropModal(false)}
                className={styles.modalClose}
                aria-label="Close"
                autoFocus
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="m4 4 8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            {challenges.length === 0 && !showAddChallenge && (
              <p className={styles.modalEmpty}>
                Track a funded-account challenge here: how far you are from the profit target, and how much drawdown you have left.
              </p>
            )}

            {challenges.length > 0 && (
              <div className={styles.challenges}>
                {challenges.map(c => {
                  const profit = c.current_balance - c.starting_balance
                  const profitProgress = Math.min((profit / c.profit_target) * 100, 100)
                  const drawdownProgress = Math.min((Math.max(0, -profit) / c.max_drawdown) * 100, 100)
                  const hasFailed = drawdownProgress >= 100
                  const hasPassed = profitProgress >= 100
                  const status = hasFailed ? 'Failed' : hasPassed ? 'Passed' : 'Active'
                  const statusClass = hasFailed ? styles.stFailed : hasPassed ? styles.stPassed : styles.stActive

                  return (
                    <article key={c.id} className={styles.challenge}>
                      <div className={styles.challengeHead}>
                        <div>
                          <h3 className={styles.challengeFirm}>{c.firm_name}</h3>
                          <p className={styles.challengeMeta}>
                            {money(c.account_size, 0)} account
                            {c.daily_loss_limit ? `, ${money(c.daily_loss_limit, 0)} daily loss limit` : ''}
                          </p>
                        </div>
                        <div className={styles.challengeSide}>
                          <span className={`${styles.status} ${statusClass}`}>{status}</span>
                          <button
                            onClick={() => (pendingDelete === c.id ? handleDeleteChallenge(c.id) : setPendingDelete(c.id))}
                            onBlur={() => setPendingDelete(null)}
                            className={styles.removeBtn}
                          >
                            {pendingDelete === c.id ? 'Tap again to remove' : 'Remove'}
                          </button>
                        </div>
                      </div>

                      <Meter
                        label="Profit target"
                        value={`${signed(profit)} of ${money(c.profit_target, 0)}`}
                        valueClass={profit >= 0 ? styles.gain : styles.loss}
                        sub={`${profitProgress.toFixed(1)}% of the way there`}
                        fill={Math.max(0, profitProgress)}
                        fillClass={styles.mGain}
                      />

                      <Meter
                        label="Drawdown used"
                        value={`${money(Math.max(0, -profit))} of ${money(c.max_drawdown, 0)}`}
                        valueClass={drawdownProgress > 75 ? styles.loss : styles.gain}
                        sub={`${drawdownProgress.toFixed(1)}% of your max drawdown`}
                        fill={drawdownProgress}
                        fillClass={drawdownProgress > 75 ? styles.mLoss : drawdownProgress > 50 ? styles.mWarn : styles.mGain}
                      />

                      <div className={styles.updateRow}>
                        <label className={styles.fieldLabel} htmlFor={`balance-${c.id}`}>Current balance</label>
                        <div className={styles.updateControls}>
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={c.current_balance}
                            className={styles.input}
                            id={`balance-${c.id}`}
                          />
                          <button
                            onClick={() => {
                              const input = document.getElementById(`balance-${c.id}`) as HTMLInputElement
                              handleUpdateBalance(c.id, parseFloat(input.value))
                            }}
                            className={styles.btnSolid}
                          >
                            Update
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            {showAddChallenge ? (
              <div className={styles.addForm}>
                <h3 className={styles.addTitle}>New challenge</h3>

                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="firm">Prop firm</label>
                  <select
                    id="firm"
                    value={form.firm_name}
                    onChange={e => handleFirmSelect(e.target.value)}
                    className={styles.input}
                  >
                    {FIRMS.map(f => <option key={f.name}>{f.name}</option>)}
                  </select>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="size">Account size ($)</label>
                    <input
                      id="size"
                      type="number"
                      placeholder="50000"
                      value={form.account_size}
                      onChange={e => handleAccountSize(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="balance">Current balance ($)</label>
                    <input
                      id="balance"
                      type="number"
                      placeholder="Leave empty if you're just starting"
                      value={form.current_balance}
                      onChange={e => setForm(prev => ({ ...prev, current_balance: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className={styles.grid3}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="target">Profit target ($)</label>
                    <input
                      id="target"
                      type="number"
                      placeholder="3000"
                      value={form.profit_target}
                      onChange={e => setForm(prev => ({ ...prev, profit_target: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="dd">Max drawdown ($)</label>
                    <input
                      id="dd"
                      type="number"
                      placeholder="3000"
                      value={form.max_drawdown}
                      onChange={e => setForm(prev => ({ ...prev, max_drawdown: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="daily">Daily loss limit ($)</label>
                    <input
                      id="daily"
                      type="number"
                      placeholder="750"
                      value={form.daily_loss_limit}
                      onChange={e => setForm(prev => ({ ...prev, daily_loss_limit: e.target.value }))}
                      className={styles.input}
                    />
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button onClick={() => setShowAddChallenge(false)} className={styles.btnGhost}>Cancel</button>
                  <button onClick={handleSaveChallenge} className={styles.btnSolid} disabled={saving}>
                    {saving ? 'Saving...' : 'Save challenge'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddChallenge(true)} className={styles.addBtn}>
                Add a challenge
              </button>
            )}
          </div>
        </div>
      )}

      <main className={styles.main}>
        <div className={`${styles.inner} ${hasTrades && closed.length > 0 ? (totalPnl >= 0 ? styles.auraUp : styles.auraDown) : ''}`}>
          <header className={styles.header}>
            <div>
              <h1 className={styles.hello}>{greeting()}</h1>
              <p className={styles.date}>
                {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className={styles.actions}>
              <button onClick={() => setShowPropModal(true)} className={styles.btnGhost}>
                Prop firm
                {hasDrawdownAlert && <span className={styles.alertDot} aria-label="A challenge is close to its drawdown limit" />}
              </button>
              <Link href="/dashboard/add-trade" className={styles.btnSolid}>Log a trade</Link>
            </div>
          </header>

          {!hasTrades ? (
            <div className={styles.empty}>
              <h2>Your journal is empty</h2>
              <p>Log your first trade and this page comes alive with your numbers.</p>
              <Link href="/dashboard/add-trade" className={styles.btnSolid}>Log your first trade</Link>
            </div>
          ) : (
            <>
              <EquityHero points={equityCurve} total={totalPnl} openCount={openCount} />

              {story && <p className={styles.story}>{story}</p>}

              {closed.length > 0 && (
                <>
                  <div className={styles.trio}>
                    {periods.map(p => {
                      const pnl = sum(p.list)
                      return (
                        <div key={p.label} className={styles.period}>
                          <span className={`${styles.periodNum} ${p.list.length ? tone(pnl) : styles.flat}`}>
                            {p.list.length ? signed(pnl) : DASH}
                          </span>
                          <span className={styles.periodLabel}>{p.label}</span>
                          <span className={styles.periodNote}>
                            {p.list.length ? `${p.list.length} ${plural(p.list.length, 'trade', 'trades')}` : 'No trades yet'}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <div className={styles.ledger}>
                    {ledger.map(s => (
                      <div key={s.label} className={styles.ledgerRow}>
                        <span>{s.label}</span>
                        <span className={`${styles.ledgerValue} ${s.cls}`}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  <section className={`${styles.section} ${styles.pair}`}>
                    <div>
                      <div className={styles.sectionHead}>
                        <h2 className={styles.sectionTitle}>Recent days</h2>
                        <SeeMore href="/dashboard/analytics">Full analytics</SeeMore>
                      </div>
                      <p className={styles.sectionNote}>Your last {recentDays.length} trading {plural(recentDays.length, 'day', 'days')}. Bigger pebbles mean bigger days.</p>
                      <div className={styles.days}>
                        {recentDays.map(([date, pnl]) => {
                          const d = new Date(date)
                          return (
                            <div
                              key={date}
                              className={styles.day}
                              title={`${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${signed(pnl, 0)}`}
                            >
                              <span className={styles.dayName}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                              <div className={styles.pebbleBox} aria-hidden="true">
                                <span
                                  className={`${styles.pebble} ${pnl > 0 ? styles.pebbleGain : pnl < 0 ? styles.pebbleLoss : styles.pebbleFlat}`}
                                  style={{ '--s': Math.sqrt(Math.abs(pnl) / maxRecentDay) } as React.CSSProperties}
                                />
                              </div>
                              <span className={`${styles.dayPnl} ${tone(pnl)}`}>{compact(pnl)}</span>
                              <span className={styles.dayDate}>{d.getDate()}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <div className={styles.sectionHead}>
                        <h2 className={styles.sectionTitle}>Top setups</h2>
                        <SeeMore href="/dashboard/analytics">See all</SeeMore>
                      </div>
                      <p className={styles.sectionNote}>
                        {setupRows.length > 0 && !(setupRows.length === 1 && setupRows[0].name === 'Untagged')
                          ? 'Where your money has come from.'
                          : 'Tag your trades with a setup and they show up here.'}
                      </p>
                      <Breakdown rows={setupRows} />
                    </div>
                  </section>
                </>
              )}

              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h2 className={styles.sectionTitle}>Recent trades</h2>
                  <SeeMore href="/dashboard/trades">See all</SeeMore>
                </div>
                <div className={styles.trades}>
                  {trades.slice(0, 8).map(trade => {
                    const isLong = trade.direction === 'LONG'
                    return (
                      <div key={trade.id} className={styles.trade}>
                        <span className={styles.tInst}>{trade.instrument}</span>
                        <span className={styles.tDir}>
                          <i className={`${styles.swatch} ${isLong ? styles.swLong : styles.swShort}`} />
                          {isLong ? 'Long' : 'Short'}
                        </span>
                        <span className={styles.tSetup}>{trade.setup_tag || 'No setup tag'}</span>
                        {trade.is_open ? (
                          <span className={styles.tPnl}>
                            <i className={styles.liveDot} />
                            Open
                          </span>
                        ) : (
                          <span className={`${styles.tPnl} ${trade.pnl != null ? tone(trade.pnl) : styles.flat}`}>
                            {trade.pnl != null ? signed(trade.pnl) : DASH}
                          </span>
                        )}
                        <span className={styles.tDate}>
                          {new Date(trade.entry_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
