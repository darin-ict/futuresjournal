'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '../../components/Sidebar'
import styles from './add-trade.module.css'

export default function AddTrade() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    instrument: 'ES',
    direction: 'LONG',
    entry_price: '',
    exit_price: '',
    stop_loss: '',
    contracts: '1',
    trade_date: new Date().toISOString().split('T')[0],
    setup_tag: '',
    mistake_tag: '',
    notes: '',
    is_open: false,
  })

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
    }
    getUser()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScreenshot(file)
    setScreenshotPreview(URL.createObjectURL(file))
  }

  const removeScreenshot = () => {
    setScreenshot(null)
    setScreenshotPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const calcPnl = () => {
    const entry = parseFloat(form.entry_price)
    const exit = parseFloat(form.exit_price)
    const contracts = parseInt(form.contracts)
    if (!entry || !exit || !contracts) return null
    const tickValues: Record<string, number> = {
      ES: 12.50, NQ: 5.00, CL: 10.00, GC: 10.00,
      SI: 25.00, ZB: 31.25, ZN: 15.625, RTY: 5.00,
      YM: 5.00, MES: 1.25, MNQ: 0.50, MCL: 1.00,
    }
    const tickSizes: Record<string, number> = {
      ES: 0.25, NQ: 0.25, CL: 0.01, GC: 0.10,
      SI: 0.005, ZB: 0.03125, ZN: 0.015625, RTY: 0.10,
      YM: 1.00, MES: 0.25, MNQ: 0.25, MCL: 0.01,
    }
    const tickValue = tickValues[form.instrument] || 12.50
    const tickSize = tickSizes[form.instrument] || 0.25
    const priceDiff = form.direction === 'LONG' ? exit - entry : entry - exit
    const ticks = priceDiff / tickSize
    return parseFloat((ticks * tickValue * contracts).toFixed(2))
  }

  const calcRisk = () => {
    const entry = parseFloat(form.entry_price)
    const stop = parseFloat(form.stop_loss)
    const contracts = parseInt(form.contracts)
    if (!entry || !stop || !contracts) return null
    const tickValues: Record<string, number> = {
      ES: 12.50, NQ: 5.00, CL: 10.00, GC: 10.00,
      SI: 25.00, ZB: 31.25, ZN: 15.625, RTY: 5.00,
      YM: 5.00, MES: 1.25, MNQ: 0.50, MCL: 1.00,
    }
    const tickSizes: Record<string, number> = {
      ES: 0.25, NQ: 0.25, CL: 0.01, GC: 0.10,
      SI: 0.005, ZB: 0.03125, ZN: 0.015625, RTY: 0.10,
      YM: 1.00, MES: 0.25, MNQ: 0.25, MCL: 0.01,
    }
    const tickValue = tickValues[form.instrument] || 12.50
    const tickSize = tickSizes[form.instrument] || 0.25
    const riskDiff = form.direction === 'LONG' ? entry - stop : stop - entry
    const ticks = riskDiff / tickSize
    return parseFloat((ticks * tickValue * contracts).toFixed(2))
  }

  const pnl = calcPnl()
  const risk = calcRisk()
  const rr = pnl && risk && risk > 0 ? (pnl / risk).toFixed(2) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setError('')

    // Upload screenshot if attached
    let screenshotUrl = null
    if (screenshot) {
      setUploadingImage(true)
      const fileExt = screenshot.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('trade-screenshots')
        .upload(fileName, screenshot)

      if (uploadError) {
        setError('Image upload failed: ' + uploadError.message)
        setLoading(false)
        setUploadingImage(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('trade-screenshots')
        .getPublicUrl(fileName)

      screenshotUrl = urlData.publicUrl
      setUploadingImage(false)
    }

    const { error } = await supabase.from('trades').insert([{
      user_id: user.id,
      instrument: form.instrument,
      direction: form.direction,
      entry_price: parseFloat(form.entry_price),
      exit_price: form.exit_price ? parseFloat(form.exit_price) : null,
      contracts: parseInt(form.contracts),
      entry_time: new Date(form.trade_date).toISOString(),
      pnl: pnl,
      setup_tag: form.setup_tag || null,
      notes: form.notes || null,
      mistake_tag: form.mistake_tag || null,
      is_open: form.is_open,
      screenshot_url: screenshotUrl,
      session: 'RTH',
      emotional_state: 3,
    }])

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  const resetForm = () => {
    setSuccess(false)
    setScreenshot(null)
    setScreenshotPreview(null)
    setForm({
      instrument: 'ES', direction: 'LONG', entry_price: '', exit_price: '',
      stop_loss: '', contracts: '1', trade_date: new Date().toISOString().split('T')[0],
      setup_tag: '', mistake_tag: '', notes: '', is_open: false,
    })
  }

  if (success) {
    return (
      <div className={styles.layout}>
        <Sidebar userEmail={user?.email || ''} />
        <main className={styles.main}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}>✓</div>
            <h2>Trade Logged!</h2>
            {pnl !== null && (
              <div className={`${styles.successPnl} ${pnl >= 0 ? styles.green : styles.red}`}>
                {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
              </div>
            )}
            <p>Saved to your journal.</p>
            <div className={styles.successActions}>
              <button onClick={resetForm} className={styles.btnGhost}>Log Another</button>
              <Link href="/dashboard" className={styles.btnPrimary}>Dashboard</Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <Sidebar userEmail={user?.email || ''} />

      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Log New Trade</h1>
            <p className={styles.headerSubtitle}>Quick and clean — only what matters</p>
          </div>
          <Link href="/dashboard" className={styles.btnGhost}>← Back</Link>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>📊 Trade Details</h2>
            <div className={styles.grid3}>
              <div className={styles.field}>
                <label className={styles.label}>Instrument</label>
                <select name="instrument" value={form.instrument} onChange={handleChange} className={styles.select}>
                  <option>ES</option><option>NQ</option><option>CL</option>
                  <option>GC</option><option>SI</option><option>ZB</option>
                  <option>ZN</option><option>RTY</option><option>YM</option>
                  <option>MES</option><option>MNQ</option><option>MCL</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Direction</label>
                <select name="direction" value={form.direction} onChange={handleChange} className={styles.select}>
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Date</label>
                <input name="trade_date" type="date" value={form.trade_date} onChange={handleChange} className={styles.input} required />
              </div>
            </div>

            <div className={styles.grid3}>
              <div className={styles.field}>
                <label className={styles.label}>Entry Price</label>
                <input name="entry_price" type="number" step="0.01" placeholder="e.g. 5240.50" value={form.entry_price} onChange={handleChange} className={styles.input} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Exit Price</label>
                <input name="exit_price" type="number" step="0.01" placeholder="e.g. 5252.75" value={form.exit_price} onChange={handleChange} className={styles.input} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Stop Loss</label>
                <input name="stop_loss" type="number" step="0.01" placeholder="e.g. 5235.00" value={form.stop_loss} onChange={handleChange} className={styles.input} />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Contracts</label>
              <input name="contracts" type="number" min="1" value={form.contracts} onChange={handleChange} className={styles.input} style={{ maxWidth: '160px' }} required />
            </div>

            {(pnl !== null || risk !== null) && (
              <div className={styles.pnlPreview}>
                {pnl !== null && (
                  <div className={styles.pnlItem}>
                    <span className={styles.pnlLabel}>P&L</span>
                    <span className={`${styles.pnlValue} ${pnl >= 0 ? styles.green : styles.red}`}>
                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                    </span>
                  </div>
                )}
                {risk !== null && (
                  <div className={styles.pnlItem}>
                    <span className={styles.pnlLabel}>Risk</span>
                    <span className={styles.red}>-${risk.toFixed(2)}</span>
                  </div>
                )}
                {rr !== null && (
                  <div className={styles.pnlItem}>
                    <span className={styles.pnlLabel}>R:R</span>
                    <span className={parseFloat(rr) >= 1 ? styles.green : styles.red}>{rr}R</span>
                  </div>
                )}
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.checkboxLabel}>
                <input name="is_open" type="checkbox" checked={form.is_open} onChange={handleChange} className={styles.checkbox} />
                Trade is still open (no exit yet)
              </label>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>📋 Setup & Notes</h2>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Setup Tag</label>
                <input name="setup_tag" type="text" placeholder="e.g. VWAP Reclaim, Gap Fill" value={form.setup_tag} onChange={handleChange} className={styles.input} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Mistake Tag</label>
                <select name="mistake_tag" value={form.mistake_tag} onChange={handleChange} className={styles.select}>
                  <option value="">No mistake</option>
                  <option>Chased entry</option>
                  <option>Ignored stop</option>
                  <option>Overtraded</option>
                  <option>Sized too large</option>
                  <option>FOMO</option>
                  <option>Revenge trade</option>
                  <option>No setup</option>
                  <option>Exited too early</option>
                  <option>Moved stop</option>
                </select>
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Notes</label>
              <textarea name="notes" placeholder="What did you see? Why did you take this? What would you do differently?" value={form.notes} onChange={handleChange} className={styles.textarea} rows={3} />
            </div>
          </div>

          {/* Screenshot Upload */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>📸 Chart Screenshot</h2>
            <p className={styles.screenshotHint}>Attach your chart at entry/exit. Helps you review your reads later.</p>

            {!screenshotPreview ? (
              <div className={styles.uploadZone} onClick={() => fileInputRef.current?.click()}>
                <span className={styles.uploadIcon}>🖼️</span>
                <span className={styles.uploadText}>Click to upload chart screenshot</span>
                <span className={styles.uploadSub}>PNG, JPG, WEBP up to 5MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshot}
                  style={{ display: 'none' }}
                />
              </div>
            ) : (
              <div className={styles.screenshotPreview}>
                <img src={screenshotPreview} alt="Trade screenshot" className={styles.screenshotImg} />
                <button type="button" onClick={removeScreenshot} className={styles.removeScreenshot}>
                  ✕ Remove
                </button>
              </div>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formActions}>
            <Link href="/dashboard" className={styles.btnGhost}>Cancel</Link>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {uploadingImage ? '📸 Uploading image...' : loading ? 'Saving...' : '💾 Save Trade'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}