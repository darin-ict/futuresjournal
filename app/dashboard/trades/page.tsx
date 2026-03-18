'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '../../components/Sidebar'
import styles from './trades.module.css'

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

  const handleDelete = async (id: string) => {
    await supabase.from('trades').delete().eq('id', id)
    setTrades(prev => prev.filter(t => t.id !== id))
    setDeleteId(null)
    if (selectedTrade?.id === id) setSelectedTrade(null)
  }

  const instruments = ['ALL', ...Array.from(new Set(trades.map(t => t.instrument)))]
  const closed = filtered.filter(t => !t.is_open && t.pnl != null)
  const totalPnl = closed.reduce((s, t) => s + t.pnl, 0)
  const winners = closed.filter(t => t.pnl > 0)
  const losers = closed.filter(t => t.pnl < 0)
  const winRate = closed.length > 0 ? Math.round((winners.length / closed.length) * 100) : 0
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
        <div className={styles.overlay} onClick={() => setSelectedTrade(null)}>
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
              <button onClick={() => setSelectedTrade(null)} className={styles.popupClose}>✕</button>
            </div>

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
              </div>
            </div>
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