'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import styles from './settings.module.css'

export default function Settings() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passSaving, setPassSaving] = useState(false)
  const [passSaved, setPassSaved] = useState(false)
  const [passError, setPassError] = useState('')

  // Tradovate connection
  const [tradovateConn, setTradovateConn] = useState<any>(null)
  const [tvUsername, setTvUsername] = useState('')
  const [tvPassword, setTvPassword] = useState('')
  const [tvDemo, setTvDemo] = useState(true)
  const [tvConnecting, setTvConnecting] = useState(false)
  const [tvSyncing, setTvSyncing] = useState(false)
  const [tvMessage, setTvMessage] = useState('')
  const [tvError, setTvError] = useState('')

  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{
    success: number
    skipped: number
    errors: string[]
  } | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      if (profile?.full_name) setFullName(profile.full_name)
      fetchTradovateConnection(user.id)
      setLoading(false)
    }
    getUser()
  }, [])

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setNameSaving(true)
    setNameError('')
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user.id)
    if (error) { setNameError(error.message) }
    else { setNameSaved(true); setTimeout(() => setNameSaved(false), 3000) }
    setNameSaving(false)
  }

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassError('')
    if (newPassword.length < 6) { setPassError('Password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword) { setPassError('Passwords do not match'); return }
    setPassSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPassError(error.message) }
    else {
      setPassSaved(true)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPassSaved(false), 3000)
    }
    setPassSaving(false)
  }

  const fetchTradovateConnection = async (userId: string) => {
    const { data } = await supabase
      .from('tradovate_connections')
      .select('*')
      .eq('user_id', userId)
      .single()
    setTradovateConn(data)
  }

  const handleTradovateConnect = async () => {
    if (!user || !tvUsername || !tvPassword) return
    setTvConnecting(true)
    setTvError('')
    setTvMessage('')

    const res = await fetch('/api/tradovate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'connect',
        userId: user.id,
        username: tvUsername,
        password: tvPassword,
        isDemo: tvDemo,
      }),
    })

    const data = await res.json()

    if (data.error) {
      setTvError(data.error)
    } else {
      setTvMessage(`✓ Connected to ${data.accountName}`)
      fetchTradovateConnection(user.id)
    }
    setTvConnecting(false)
  }

  const handleTradovateSync = async () => {
    if (!user) return
    setTvSyncing(true)
    setTvMessage('')
    setTvError('')

    const res = await fetch('/api/tradovate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync', userId: user.id }),
    })

    const data = await res.json()

    if (data.error) {
      setTvError(data.error)
    } else {
      setTvMessage(`✓ ${data.message}`)
      fetchTradovateConnection(user.id)
    }
    setTvSyncing(false)
  }

  const handleTradovateDisconnect = async () => {
    if (!user) return
    await fetch('/api/tradovate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect', userId: user.id }),
    })
    setTradovateConn(null)
    setTvMessage('')
  }

  const parseTradovateCSV = (text: string) => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = values[i] || '' })
      return row
    }).filter(row => Object.values(row).some(v => v !== ''))
  }

  const parsePnl = (raw: string): number => {
    if (!raw) return 0
    const cleaned = raw.replace(/\$|\s/g, '')
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      return -parseFloat(cleaned.slice(1, -1).replace(/,/g, ''))
    }
    return parseFloat(cleaned.replace(/,/g, '')) || 0
  }

  const getBase = (symbol: string) => {
    const s = symbol.toUpperCase()
    const bases = ['MNQ', 'MES', 'MCL', 'ES', 'NQ', 'CL', 'GC', 'SI', 'ZB', 'ZN', 'RTY', 'YM']
    for (const key of bases) {
      if (s.startsWith(key)) return key
    }
    return s.replace(/[A-Z]\d+$/, '') || s
  }

  const handleImport = async () => {
    if (!user || !csvText.trim()) return
    setImporting(true)
    setImportResults(null)

    const rows = parseTradovateCSV(csvText)
    if (rows.length === 0) {
      setImportResults({ success: 0, skipped: 0, errors: ['No valid rows found. Make sure you pasted the full CSV including the header row.'] })
      setImporting(false)
      return
    }

    let success = 0
    let skipped = 0
    const errors: string[] = []

    for (const row of rows) {
      try {
        const symbol = row['symbol'] || ''
        const qty = parseInt(row['qty'] || '1')
        const buyPrice = parseFloat(row['buyprice'] || '0')
        const sellPrice = parseFloat(row['sellprice'] || '0')
        const pnlRaw = row['pnl'] || '0'
        const boughtTs = row['boughttimestamp'] || ''
        const soldTs = row['soldtimestamp'] || ''
        const buyFillId = row['buyfillid'] || '0'
        const sellFillId = row['sellfillid'] || '0'

        if (!symbol || !buyPrice || !sellPrice) { skipped++; continue }

        const base = getBase(symbol)
        const pnl = parsePnl(pnlRaw)

        // If buyFillId < sellFillId, bought first = LONG, else SHORT
        const direction = parseInt(buyFillId) < parseInt(sellFillId) ? 'LONG' : 'SHORT'
        const entryPrice = direction === 'LONG' ? buyPrice : sellPrice
        const exitPrice = direction === 'LONG' ? sellPrice : buyPrice

        let entryTime = new Date().toISOString()
        const entryTsRaw = direction === 'LONG' ? boughtTs : soldTs
        if (entryTsRaw) {
          const parsed = new Date(entryTsRaw)
          if (!isNaN(parsed.getTime())) entryTime = parsed.toISOString()
        }

        let exitTime = null
        const exitTsRaw = direction === 'LONG' ? soldTs : boughtTs
        if (exitTsRaw) {
          const parsed = new Date(exitTsRaw)
          if (!isNaN(parsed.getTime())) exitTime = parsed.toISOString()
        }

        const { error } = await supabase.from('trades').insert([{
          user_id: user.id,
          instrument: base,
          direction,
          entry_price: entryPrice,
          exit_price: exitPrice,
          contracts: qty || 1,
          entry_time: entryTime,
          exit_time: exitTime,
          pnl,
          is_open: false,
          session: 'RTH',
          emotional_state: 3,
        }])

        if (error) { errors.push(`Row skipped: ${error.message}`); skipped++ }
        else success++
      } catch {
        skipped++
      }
    }

    setImportResults({ success, skipped, errors })
    if (success > 0) setCsvText('')
    setImporting(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => { setCsvText(event.target?.result as string) }
    reader.readAsText(file)
  }

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p>Loading settings...</p>
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <Sidebar userEmail={user?.email || ''} />

      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Settings</h1>
            <p className={styles.headerSubtitle}>Manage your account and import trades</p>
          </div>
        </div>

        <div className={styles.sections}>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>👤 Profile</h2>
            <form onSubmit={handleSaveName} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input type="email" value={user?.email || ''} disabled className={`${styles.input} ${styles.inputDisabled}`} />
                <p className={styles.fieldHint}>Email cannot be changed</p>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Display Name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" className={styles.input} />
              </div>
              {nameError && <div className={styles.error}>{nameError}</div>}
              <button type="submit" className={styles.btnPrimary} disabled={nameSaving}>
                {nameSaving ? 'Saving...' : nameSaved ? '✓ Saved!' : 'Save Name'}
              </button>
            </form>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>🔒 Change Password</h2>
            <form onSubmit={handleSavePassword} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" className={styles.input} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" className={styles.input} />
              </div>
              {passError && <div className={styles.error}>{passError}</div>}
              <button type="submit" className={styles.btnPrimary} disabled={passSaving}>
                {passSaving ? 'Saving...' : passSaved ? '✓ Password Updated!' : 'Update Password'}
              </button>
            </form>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>⚡ Tradovate Auto Sync</h2>
            {tradovateConn ? (
              <div className={styles.connectedBox}>
                <div className={styles.connectedHeader}>
                  <div>
                    <span className={styles.connectedBadge}>✓ Connected</span>
                    <p className={styles.connectedAccount}>{tradovateConn.account_name}</p>
                    <p className={styles.connectedMeta}>
                      {tradovateConn.is_demo ? 'Demo account' : 'Live account'} •
                      {tradovateConn.last_synced_at ? ` Last synced ${new Date(tradovateConn.last_synced_at).toLocaleString()}` : ' Never synced'}
                    </p>
                  </div>
                  <button onClick={handleTradovateDisconnect} className={styles.disconnectBtn}>Disconnect</button>
                </div>
                {tvMessage && <div className={styles.successMsg}>{tvMessage}</div>}
                {tvError && <div className={styles.error}>{tvError}</div>}
                <button onClick={handleTradovateSync} className={styles.btnPrimary} disabled={tvSyncing}>
                  {tvSyncing ? '⏳ Syncing...' : '🔄 Sync Trades Now'}
                </button>
              </div>
            ) : (
              <div className={styles.form}>
                <p className={styles.fieldHint}>Connect your Tradovate account to automatically import trades. Your credentials are stored securely.</p>
                <div className={styles.field}>
                  <label className={styles.label}>Account Type</label>
                  <div className={styles.toggleRow}>
                    <button type="button" onClick={() => setTvDemo(true)} className={tvDemo ? styles.toggleActive : styles.toggleInactive}>Demo / Sim</button>
                    <button type="button" onClick={() => setTvDemo(false)} className={!tvDemo ? styles.toggleActive : styles.toggleInactive}>Live</button>
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Tradovate Username</label>
                  <input type="text" value={tvUsername} onChange={e => setTvUsername(e.target.value)} placeholder="Your Tradovate username" className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Tradovate Password</label>
                  <input type="password" value={tvPassword} onChange={e => setTvPassword(e.target.value)} placeholder="Your Tradovate password" className={styles.input} />
                </div>
                {tvError && <div className={styles.error}>{tvError}</div>}
                {tvMessage && <div className={styles.successMsg}>{tvMessage}</div>}
                <button onClick={handleTradovateConnect} className={styles.btnPrimary} disabled={tvConnecting || !tvUsername || !tvPassword}>
                  {tvConnecting ? 'Connecting...' : '⚡ Connect Tradovate'}
                </button>
              </div>
            )}
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>📥 Import Trades from Tradovate</h2>
            <div className={styles.importInstructions}>
              <p className={styles.instrTitle}>How to export from Tradovate:</p>
              <ol className={styles.instrList}>
                <li>Log into Tradovate</li>
                <li>Go to <strong>Account</strong> → <strong>Performance</strong></li>
                <li>Click <strong>Export</strong> and choose <strong>CSV</strong></li>
                <li>Open the file, select all, copy and paste below</li>
                <li>Or click <strong>Upload CSV file</strong> to upload directly</li>
              </ol>
            </div>

            <div className={styles.importActions}>
              <button onClick={() => fileInputRef.current?.click()} className={styles.btnGhost}>
                📂 Upload CSV File
              </button>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Or paste CSV content here</label>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder="Paste your Tradovate CSV here..."
                className={styles.csvTextarea}
                rows={8}
              />
            </div>

            {csvText && (
              <div className={styles.csvPreview}>
                <span className={styles.csvPreviewText}>
                  {csvText.trim().split('\n').length - 1} trade rows detected
                </span>
              </div>
            )}

            {importResults && (
              <div className={`${styles.importResults} ${importResults.success > 0 ? styles.importSuccess : styles.importError}`}>
                {importResults.success > 0 && <p className={styles.importSuccessText}>✓ {importResults.success} trades imported successfully!</p>}
                {importResults.skipped > 0 && <p className={styles.importSkippedText}>⚠ {importResults.skipped} rows skipped</p>}
                {importResults.errors.slice(0, 3).map((err, i) => <p key={i} className={styles.importErrorText}>{err}</p>)}
              </div>
            )}

            <button onClick={handleImport} className={styles.btnPrimary} disabled={importing || !csvText.trim()}>
              {importing ? 'Importing...' : '📥 Import Trades'}
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}