'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import styles from './playbook.module.css'

export default function Playbook() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [setups, setSetups] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', description: '', entry_criteria: '', exit_criteria: '', ideal_conditions: '',
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
    const [{ data: setupData }, { data: tradeData }] = await Promise.all([
      supabase.from('playbook_setups').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('trades').select('*').eq('user_id', userId).eq('is_open', false).not('pnl', 'is', null),
    ])
    setSetups(setupData || [])
    setTrades(tradeData || [])
    setLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (editingId) {
      await supabase.from('playbook_setups').update({
        name: form.name, description: form.description,
        entry_criteria: form.entry_criteria, exit_criteria: form.exit_criteria,
        ideal_conditions: form.ideal_conditions,
      }).eq('id', editingId)
    } else {
      await supabase.from('playbook_setups').insert([{
        user_id: user.id, name: form.name, description: form.description,
        entry_criteria: form.entry_criteria, exit_criteria: form.exit_criteria,
        ideal_conditions: form.ideal_conditions,
      }])
    }
    setForm({ name: '', description: '', entry_criteria: '', exit_criteria: '', ideal_conditions: '' })
    setShowForm(false)
    setEditingId(null)
    fetchData(user.id)
  }

  const handleEdit = (setup: any) => {
    setForm({
      name: setup.name, description: setup.description || '',
      entry_criteria: setup.entry_criteria || '', exit_criteria: setup.exit_criteria || '',
      ideal_conditions: setup.ideal_conditions || '',
    })
    setEditingId(setup.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: string) => {
    await supabase.from('playbook_setups').delete().eq('id', id)
    setSetups(prev => prev.filter(s => s.id !== id))
    setDeleteId(null)
  }

  const getStats = (name: string) => {
    const linked = trades.filter(t => t.setup_tag === name)
    const winners = linked.filter(t => t.pnl > 0)
    const totalPnl = linked.reduce((s, t) => s + t.pnl, 0)
    const winRate = linked.length > 0 ? Math.round((winners.length / linked.length) * 100) : null
    return { count: linked.length, winRate, totalPnl }
  }

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p>Loading playbook...</p>
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <Sidebar userEmail={user?.email || ''} />

      <main className={styles.main}>
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <span className={styles.pageTitle}>Playbook</span>
            <span className={styles.pageSubtitle}>{setups.length} documented setups</span>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm)
              setEditingId(null)
              setForm({ name: '', description: '', entry_criteria: '', exit_criteria: '', ideal_conditions: '' })
            }}
            className={showForm ? styles.btnGhost : styles.btnPrimary}
          >
            {showForm ? '✕ Cancel' : '+ New Setup'}
          </button>
        </div>

        <div className={styles.content}>

          {showForm && (
            <div className={styles.formCard}>
              <h2 className={styles.cardTitle}>{editingId ? 'Edit Setup' : 'New Setup'}</h2>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Setup Name *</label>
                    <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. VWAP Reclaim, ORB, Gap Fill" className={styles.input} required />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Short Description</label>
                    <input name="description" value={form.description} onChange={handleChange} placeholder="One line summary of the setup" className={styles.input} />
                  </div>
                </div>
                <div className={styles.grid3}>
                  <div className={styles.field}>
                    <label className={styles.label}>Entry Criteria</label>
                    <textarea name="entry_criteria" value={form.entry_criteria} onChange={handleChange} placeholder="What conditions must be met to enter?" className={styles.textarea} rows={4} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Exit Criteria</label>
                    <textarea name="exit_criteria" value={form.exit_criteria} onChange={handleChange} placeholder="When do you take profit or cut?" className={styles.textarea} rows={4} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Ideal Conditions</label>
                    <textarea name="ideal_conditions" value={form.ideal_conditions} onChange={handleChange} placeholder="Trending? Ranging? Time of day?" className={styles.textarea} rows={4} />
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button type="submit" className={styles.btnPrimary}>
                    {editingId ? '💾 Save Changes' : '💾 Save Setup'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {setups.length === 0 && !showForm ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📋</span>
              <h3>No setups documented yet</h3>
              <p>Build your playbook by documenting your best setups. Every trade you tag will automatically link back to the right setup and show live stats.</p>
              <button onClick={() => setShowForm(true)} className={styles.btnPrimary}>
                + Create First Setup
              </button>
            </div>
          ) : (
            <div className={styles.setupsGrid}>
              {setups.map(setup => {
                const stats = getStats(setup.name)
                return (
                  <div key={setup.id} className={styles.setupCard}>
                    <div className={styles.setupHeader}>
                      <div className={styles.setupTitleBlock}>
                        <h3 className={styles.setupName}>{setup.name}</h3>
                        {setup.description && <p className={styles.setupDesc}>{setup.description}</p>}
                      </div>
                      <div className={styles.setupActions}>
                        <button onClick={() => handleEdit(setup)} className={styles.editBtn}>✏️</button>
                        {deleteId === setup.id ? (
                          <div className={styles.confirmDelete}>
                            <button onClick={() => handleDelete(setup.id)} className={styles.confirmYes}>Delete</button>
                            <button onClick={() => setDeleteId(null)} className={styles.confirmNo}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteId(setup.id)} className={styles.deleteBtn}>✕</button>
                        )}
                      </div>
                    </div>

                    <div className={styles.setupStats}>
                      <div className={styles.setupStat}>
                        <span className={styles.setupStatLabel}>Trades</span>
                        <span className={styles.setupStatValue}>{stats.count}</span>
                      </div>
                      <div className={styles.setupStat}>
                        <span className={styles.setupStatLabel}>Win Rate</span>
                        <span className={`${styles.setupStatValue} ${stats.winRate !== null ? (stats.winRate >= 50 ? styles.green : styles.red) : styles.muted}`}>
                          {stats.winRate !== null ? `${stats.winRate}%` : '—'}
                        </span>
                      </div>
                      <div className={styles.setupStat}>
                        <span className={styles.setupStatLabel}>Total P&L</span>
                        <span className={`${styles.setupStatValue} ${stats.count > 0 ? (stats.totalPnl >= 0 ? styles.green : styles.red) : styles.muted}`}>
                          {stats.count > 0 ? `${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}` : '—'}
                        </span>
                      </div>
                    </div>

                    {(setup.entry_criteria || setup.exit_criteria || setup.ideal_conditions) && (
                      <div className={styles.criteriaGrid}>
                        {setup.entry_criteria && (
                          <div className={styles.criteriaBlock}>
                            <span className={styles.criteriaLabel}>📥 Entry</span>
                            <p className={styles.criteriaText}>{setup.entry_criteria}</p>
                          </div>
                        )}
                        {setup.exit_criteria && (
                          <div className={styles.criteriaBlock}>
                            <span className={styles.criteriaLabel}>📤 Exit</span>
                            <p className={styles.criteriaText}>{setup.exit_criteria}</p>
                          </div>
                        )}
                        {setup.ideal_conditions && (
                          <div className={styles.criteriaBlock}>
                            <span className={styles.criteriaLabel}>🌤️ Conditions</span>
                            <p className={styles.criteriaText}>{setup.ideal_conditions}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}