'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '../../components/Sidebar'
import styles from './trades.module.css'

const TICK_VALUES: Record<string, number> = {
  ES: 12.50, NQ: 5.00, CL: 10.00, GC: 10.00,
  SI: 25.00, ZB: 31.25, ZN: 15.625, RTY: 5.00,
  YM: 5.00, MES: 1.25, MNQ: 0.50, MCL: 1.00,
}
const TICK_SIZES: Record<string, number> = {
  ES: 0.25, NQ: 0.25, CL: 0.01, GC: 0.10,
  SI: 0.005, ZB: 0.03125, ZN: 0.015625, RTY: 0.10,
  YM: 1.00, MES: 0.25, MNQ: 0.25, MCL: 0.01,
}
const MISTAKES = ['Chased entry','Ignored stop','Overtraded','Sized too large','FOMO','Revenge trade','No setup','Exited too early','Moved stop']

const calcPnl = (f: any) => {
  const entry = parseFloat(f.entry_price)
  const exit = parseFloat(f.exit_price)
  const contracts = parseInt(f.contracts)
  if (!entry || !exit || !contracts) return ''
  const tickValue = TICK_VALUES[f.instrument] || 12.50
  const tickSize = TICK_SIZES[f.instrument] || 0.25
  const diff = f.direction === 'LONG' ? exit - entry : entry - exit
  return parseFloat(((diff / tickSize) * tickValue * contracts).toFixed(2))
}

export default function TradeLog() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [trades, setTrades] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDirection, setFilterDirection] = useState('ALL')
  const [filterInstrument, setFilterInstrument] = useState('ALL')
  const [filterResult, setFilterResult] = useState('ALL')
  const [sortBy, setSortBy] = useState('newest')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<any>(null)
  const [editingTrade, setEditingTrade] = useState(false)
  const [editForm, setEditForm] = useState<any>({})

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
    setFiltered(data || [])
    setLoading(false)
  }

  useEffect(() => {
    let result = [...trades]
    if (filterDirection !== 'ALL') result = result.filter(t => t.direction === filterDirection)
    if (filterInstrument !== 'ALL') result = result.filter(t => t.instrument === filterInstrument)
    if (filterResult === 'WIN') result = result.filter(t => t.pnl > 0)
    else if (filterResult === 'LOSS') result = result.filter(t => t.pnl < 0)
    else if (filterResult === 'OPEN') result = result.filter(t => t.is_open)
    if (sortBy === 'newest') result.sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime())
    else if (sortBy === 'oldest') result.sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime())
    else if (sortBy === 'biggest_win') result.sort((a, b) => (b.pnl || 0) - (a.pnl || 0))
    else if (sortBy === 'biggest_loss') result.sort((a, b) => (a.pnl || 0) - (b.pnl || 0))
    setFiltered(result)
  }, [filterDirection, filterInstrument, filterResult, sortBy, trades])

  const closePopup = () => {
    setSelectedTrade(null)
    setEditingTrade(false)
  }

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const next = { ...editForm, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }
    if (['entry_price', 'exit_price', 'contracts', 'direction', 'instrument'].includes(name)) {
      next.pnl = calcPnl(next)
    }
    setEditForm(next)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('trades').delete().eq('id', id)
    setTrades(prev => prev.filter(t => t.id !== id))
    setDeleteId(null)
    if (selectedTrade?.id === id) closePopup()
  }
  const startEditing = () => {
  if (!selectedTrade) return

  setEditForm({
    instrument: selectedTrade.instrument,
    direction: selectedTrade.direction,
    trade_date: new Date(selectedTrade.entry_time).toISOString().slice(0, 10),
    entry_price: selectedTrade.entry_price ?? '',
    exit_price: selectedTrade.exit_price ?? '',
    contracts: selectedTrade.contracts ?? 1,
    pnl: selectedTrade.pnl ?? '',
    setup_tag: selectedTrade.setup_tag ?? '',
    mistake_tag: selectedTrade.mistake_tag ?? '',
    notes: selectedTrade.notes ?? '',
    is_open: selectedTrade.is_open ?? false,
  })

  setEditingTrade(true)
}
  const handleUpdateTrade = async (e: React.FormEvent) => {
  e.preventDefault()

  if (!selectedTrade) return

  const { error } = await supabase
    .from('trades')
    .update({
      instrument: editForm.instrument,
      direction: editForm.direction,
      entry_time: new Date(`${editForm.trade_date}T12:00:00.000Z`).toISOString(),
      entry_price: Number(editForm.entry_price),
      exit_price: editForm.exit_price === '' ? null : Number(editForm.exit_price),
      contracts: Number(editForm.contracts),
      pnl: editForm.pnl === '' ? null : Number(editForm.pnl),
      setup_tag: editForm.setup_tag || null,
      mistake_tag: editForm.mistake_tag || null,
      notes: editForm.notes || null,
      is_open: editForm.is_open,
    })
    .eq('id', selectedTrade.id)
    .eq('user_id', user.id)

  if (error) {
    alert(error.message)
    return
  }

  // keep prop firm balance in sync if this trade belongs to a challenge
  if (selectedTrade.challenge_id) {
    const effective = (open: boolean, p: number | null) => (!open && p != null ? p : 0)
    const oldEff = effective(selectedTrade.is_open, selectedTrade.pnl)
    const newEff = effective(editForm.is_open, editForm.pnl === '' ? null : Number(editForm.pnl))
    const delta = newEff - oldEff
    if (delta !== 0) {
      const { data: ch } = await supabase
        .from('prop_challenges')
        .select('current_balance')
        .eq('id', selectedTrade.challenge_id)
        .single()
      if (ch) {
        await supabase
          .from('prop_challenges')
          .update({ current_balance: ch.current_balance + delta })
          .eq('id', selectedTrade.challenge_id)
      }
    }
  }

  const updatedTrade = {
    ...selectedTrade,
    ...editForm,
    entry_time: new Date(`${editForm.trade_date}T12:00:00.000Z`).toISOString(),
    entry_price: Number(editForm.entry_price),
    exit_price: editForm.exit_price === '' ? null : Number(editForm.exit_price),
    contracts: Number(editForm.contracts),
    pnl: editForm.pnl === '' ? null : Number(editForm.pnl),
  }

  setTrades(prev =>
    prev.map(t => t.id === selectedTrade.id ? updatedTrade : t)
  )

  setSelectedTrade(updatedTrade)
  setEditingTrade(false)
}

  const instruments = ['ALL', ...Array.from(new Set(trades.map(t => t.instrument)))]
  const closed = filtered.filter(t => !t.is_open && t.pnl != null)
  const totalPnl = closed.reduce((s, t) => s + t.pnl, 0)
  const winners = closed.filter(t => t.pnl > 0)
  const losers = closed.filter(t => t.pnl < 0)
  const winRate = closed.length > 0 ? Math.round(((winners.length + closed.filter(t => t.pnl === 0).length) / closed.length) * 100) : 0
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length) : 0

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p>Loading trades...</p>
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <Sidebar userEmail={user?.email || ''} />

      {/* Trade Detail Popup */}
      {selectedTrade && (
        <div className={styles.overlay} onClick={closePopup}>
          <div className={styles.popup} onClick={e => e.stopPropagation()}>
            <div className={styles.popupHeader}>
              <div className={styles.popupTitle}>
                <span className={styles.popupInst}>{selectedTrade.instrument}</span>
                <span className={`${styles.popupDir} ${selectedTrade.direction === 'LONG' ? styles.long : styles.short}`}>
                  {selectedTrade.direction}
                </span>
                <span className={`${styles.popupPnl} ${selectedTrade.pnl > 0 ? styles.green : selectedTrade.pnl < 0 ? styles.red : ''}`}>
                  {selectedTrade.pnl != null ? `${selectedTrade.pnl > 0 ? '+' : ''}$${selectedTrade.pnl.toFixed(2)}` : 'OPEN'}
                </span>
              </div>
              <button onClick={closePopup} className={styles.popupClose}>✕</button>
            </div>

            {editingTrade ? (
              <form onSubmit={handleUpdateTrade} className={styles.editForm}>
                <div className={styles.editGrid}>
                  <label className={styles.editField}>
                    <span>Instrument</span>
                    <select name="instrument" value={editForm.instrument} onChange={handleEditChange} className={styles.editInput}>
                      {Object.keys(TICK_VALUES).map(i => <option key={i}>{i}</option>)}
                    </select>
                  </label>
                  <label className={styles.editField}>
                    <span>Direction</span>
                    <select name="direction" value={editForm.direction} onChange={handleEditChange} className={styles.editInput}>
                      <option value="LONG">LONG</option>
                      <option value="SHORT">SHORT</option>
                    </select>
                  </label>
                  <label className={styles.editField}>
                    <span>Date</span>
                    <input name="trade_date" type="date" value={editForm.trade_date} onChange={handleEditChange} className={styles.editInput} required />
                  </label>
                  <label className={styles.editField}>
                    <span>Contracts</span>
                    <input name="contracts" type="number" min="1" step="1" value={editForm.contracts} onChange={handleEditChange} className={styles.editInput} required />
                  </label>
                  <label className={styles.editField}>
                    <span>Entry Price</span>
                    <input name="entry_price" type="number" step="any" value={editForm.entry_price} onChange={handleEditChange} className={styles.editInput} required />
                  </label>
                  <label className={styles.editField}>
                    <span>Exit Price</span>
                    <input name="exit_price" type="number" step="any" value={editForm.exit_price} onChange={handleEditChange} className={styles.editInput} />
                  </label>
                  <label className={styles.editField}>
                    <span>P&L ($) — auto-calculated, you can override</span>
                    <input name="pnl" type="number" step="any" value={editForm.pnl} onChange={handleEditChange} className={styles.editInput} />
                  </label>
                  <label className={styles.editField}>
                    <span>Setup</span>
                    <input name="setup_tag" type="text" value={editForm.setup_tag} onChange={handleEditChange} className={styles.editInput} />
                  </label>
                  <label className={styles.editField}>
                    <span>Mistake</span>
                    <select name="mistake_tag" value={editForm.mistake_tag} onChange={handleEditChange} className={styles.editInput}>
                      <option value="">No mistake</option>
                      {MISTAKES.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </label>
                  <label className={`${styles.editField} ${styles.editCheck}`}>
                    <input name="is_open" type="checkbox" checked={!!editForm.is_open} onChange={handleEditChange} />
                    <span>Trade is still open</span>
                  </label>
                </div>
                <label className={styles.editField}>
                  <span>Notes</span>
                  <textarea name="notes" rows={3} value={editForm.notes} onChange={handleEditChange} className={styles.editInput} />
                </label>
                <div className={styles.editActions}>
                  <button type="button" onClick={() => setEditingTrade(false)} className={styles.confirmNo}>Cancel</button>
                  <button type="submit" className={styles.btnPrimary}>Save Changes</button>
                </div>
              </form>
            ) : (
            <>
            <div className={styles.popupGrid}>
              <div className={styles.popupStat}>
                <span className={styles.popupStatLabel}>Date</span>
                <span className={styles.popupStatValue}>
                  {new Date(selectedTrade.entry_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className={styles.popupStat}>
                <span className={styles.popupStatLabel}>Entry Price</span>
                <span className={styles.popupStatValue}>{selectedTrade.entry_price}</span>
              </div>
              <div className={styles.popupStat}>
                <span className={styles.popupStatLabel}>Exit Price</span>
                <span className={styles.popupStatValue}>{selectedTrade.exit_price ?? '—'}</span>
              </div>
              <div className={styles.popupStat}>
                <span className={styles.popupStatLabel}>Contracts</span>
                <span className={styles.popupStatValue}>{selectedTrade.contracts}</span>
              </div>
            </div>

            {(selectedTrade.setup_tag || selectedTrade.mistake_tag) && (
              <div className={styles.popupTags}>
                {selectedTrade.setup_tag && (
                  <span className={styles.tagPill}>{selectedTrade.setup_tag}</span>
                )}
                {selectedTrade.mistake_tag && (
                  <span className={styles.mistakePill}>{selectedTrade.mistake_tag}</span>
                )}
              </div>
            )}

            {selectedTrade.notes && (
              <div className={styles.popupNotes}>
                <span className={styles.popupNotesLabel}>📝 Notes</span>
                <p className={styles.popupNotesText}>{selectedTrade.notes}</p>
              </div>
            )}

            {selectedTrade.screenshot_url && (
              <div className={styles.popupScreenshot}>
                <span className={styles.popupNotesLabel}>📸 Chart</span>
                <img
                  src={selectedTrade.screenshot_url}
                  alt="Trade chart"
                  className={styles.popupImg}
                  onClick={() => window.open(selectedTrade.screenshot_url, '_blank')}
                />
                <span className={styles.popupImgHint}>Click image to open full size</span>
              </div>
            )}

            <div className={styles.popupActions}>
              <div className={styles.popupActionsRow}>
                <button
                  onClick={async () => {
                    await supabase.from('trades').update({ is_public: true }).eq('id', selectedTrade.id)
                    const url = `${window.location.origin}/share/${selectedTrade.id}`
                    navigator.clipboard.writeText(url)
                    alert('Share link copied to clipboard! 🔗')
                  }}
                  className={styles.shareBtn}
                >
                  🔗 Share Trade
                </button>
                {deleteId === selectedTrade.id ? (
                  <div className={styles.confirmDelete}>
                    <button onClick={() => handleDelete(selectedTrade.id)} className={styles.confirmYes}>Confirm Delete</button>
                    <button onClick={() => setDeleteId(null)} className={styles.confirmNo}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteId(selectedTrade.id)} className={styles.popupDeleteBtn}>
                    🗑️ Delete
                  </button>
                )}

                  <button
                  onClick={startEditing}
                  className={styles.shareBtn}
                >
                  ✏️ Edit Trade
                </button>
              </div>
            </div>
            </>
            )}
          </div>
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <span className={styles.pageTitle}>Trade Log</span>
            <span className={styles.pageSubtitle}>{filtered.length} trades shown</span>
          </div>
          <Link href="/dashboard/add-trade" className={styles.btnPrimary}>+ Log Trade</Link>
        </div>

        <div className={styles.content}>
          <div className={styles.summaryStrip}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Total P&L</span>
              <span className={`${styles.summaryValue} ${totalPnl >= 0 ? styles.green : styles.red}`}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Win Rate</span>
              <span className={`${styles.summaryValue} ${winRate >= 50 ? styles.green : styles.red}`}>
                {winRate}%
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Avg Winner</span>
              <span className={`${styles.summaryValue} ${styles.green}`}>${avgWin.toFixed(2)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Avg Loser</span>
              <span className={`${styles.summaryValue} ${styles.red}`}>-${avgLoss.toFixed(2)}</span>
            </div>
          </div>

          <div className={styles.filterBar}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Direction</label>
              <select value={filterDirection} onChange={e => setFilterDirection(e.target.value)} className={styles.filterSelect}>
                <option value="ALL">All</option>
                <option value="LONG">Long</option>
                <option value="SHORT">Short</option>
              </select>
            </div>
            <div className={styles.filterDivider} />
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Instrument</label>
              <select value={filterInstrument} onChange={e => setFilterInstrument(e.target.value)} className={styles.filterSelect}>
                {instruments.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
            <div className={styles.filterDivider} />
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Result</label>
              <select value={filterResult} onChange={e => setFilterResult(e.target.value)} className={styles.filterSelect}>
                <option value="ALL">All</option>
                <option value="WIN">Winners</option>
                <option value="LOSS">Losers</option>
                <option value="OPEN">Open</option>
              </select>
            </div>
            <div className={styles.filterDivider} />
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Sort By</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={styles.filterSelect}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="biggest_win">Biggest Win</option>
                <option value="biggest_loss">Biggest Loss</option>
              </select>
            </div>
            <div className={styles.filterSummary}>
              <span className={totalPnl >= 0 ? styles.green : styles.red}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </span>
              <span className={styles.filterSummaryDivider}>|</span>
              <span>{winRate}% WR</span>
              <span className={styles.filterSummaryDivider}>|</span>
              <span>{closed.length} closed</span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📓</span>
              <h3>No trades found</h3>
              <p>Try adjusting your filters or log a new trade</p>
              <Link href="/dashboard/add-trade" className={styles.btnPrimary}>+ Log Trade</Link>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <div className={styles.tableHead}>
                <span>Date</span>
                <span>Instrument</span>
                <span>Side</span>
                <span>Entry</span>
                <span>Exit</span>
                <span>Qty</span>
                <span>P&L</span>
                <span>Setup</span>
                <span>Mistake</span>
                <span>Chart</span>
                <span></span>
              </div>
              {filtered.map(trade => (
                <div
                  key={trade.id}
                  className={styles.tableRow}
                  onClick={() => setSelectedTrade(trade)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className={styles.dateCell}>
                    {new Date(trade.entry_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </span>
                  <span className={styles.instCell}>{trade.instrument}</span>
                  <span>
                    <span className={`${styles.dirBadge} ${trade.direction === 'LONG' ? styles.long : styles.short}`}>
                      {trade.direction}
                    </span>
                  </span>
                  <span className={styles.priceCell}>{trade.entry_price}</span>
                  <span className={styles.priceCell}>{trade.exit_price ?? '—'}</span>
                  <span>{trade.contracts}</span>
                  <span className={`${styles.pnlCell} ${trade.is_open ? styles.muted : trade.pnl > 0 ? styles.green : trade.pnl < 0 ? styles.red : ''}`}>
                    {trade.is_open ? 'OPEN' : trade.pnl != null ? `${trade.pnl > 0 ? '+' : ''}$${trade.pnl.toFixed(2)}` : '—'}
                  </span>
                  <span>
                    {trade.setup_tag
                      ? <span className={styles.tagPill}>{trade.setup_tag}</span>
                      : <span className={styles.muted}>—</span>}
                  </span>
                  <span>
                    {trade.mistake_tag
                      ? <span className={styles.mistakePill}>{trade.mistake_tag}</span>
                      : <span className={styles.muted}>—</span>}
                  </span>
                  <span onClick={e => e.stopPropagation()}>
                    {trade.screenshot_url && (
                      <img
                        src={trade.screenshot_url}
                        alt="chart"
                        className={styles.thumbImg}
                        onClick={() => window.open(trade.screenshot_url, '_blank')}
                        title="Click to view full chart"
                      />
                    )}
                  </span>
                  <span className={styles.actionsCell} onClick={e => e.stopPropagation()}>
                    {deleteId === trade.id ? (
                      <div className={styles.confirmDelete}>
                        <button onClick={() => handleDelete(trade.id)} className={styles.confirmYes}>Delete</button>
                        <button onClick={() => setDeleteId(null)} className={styles.confirmNo}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(trade.id)} className={styles.deleteBtn}>✕</button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
