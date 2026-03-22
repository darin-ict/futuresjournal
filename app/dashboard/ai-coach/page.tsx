'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import styles from './ai-coach.module.css'

export default function AICoach() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const [pastReports, setPastReports] = useState<any[]>([])
  const [userStrategy, setUserStrategy] = useState('')
  const [error, setError] = useState('')
  const [showStrategyInput, setShowStrategyInput] = useState(false)

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
    const [{ data: tradeData }, { data: reportData }] = await Promise.all([
      supabase.from('trades').select('*').eq('user_id', userId).order('entry_time', { ascending: false }),
      supabase.from('ai_coaching_reports').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    ])
    setTrades(tradeData || [])
    setPastReports(reportData || [])
    setLoading(false)
  }

  const handleAnalyze = async () => {
    if (!user) return
    setAnalyzing(true)
    setError('')
    setReport(null)

    try {
      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades, userStrategy }),
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setAnalyzing(false)
        return
      }

      setReport(data.report)

      // Save report to database
      await supabase.from('ai_coaching_reports').insert([{
        user_id: user.id,
        report: data.report,
        trade_count: trades.filter(t => !t.is_open && t.pnl != null).length,
      }])

      fetchData(user.id)
    } catch (err) {
      setError('Something went wrong. Try again.')
    }

    setAnalyzing(false)
  }

  // Format markdown-style report to JSX
  const formatReport = (text: string) => {
    const sections = text.split('## ').filter(Boolean)
    return sections.map((section, i) => {
      const lines = section.split('\n').filter(Boolean)
      const title = lines[0]
      const content = lines.slice(1).join('\n')
      return (
        <div key={i} className={styles.reportSection}>
          <h3 className={styles.reportSectionTitle}>{title}</h3>
          <div className={styles.reportSectionContent}>
            {content.split('\n').map((line, j) => {
              if (line.startsWith('- ') || line.startsWith('• ')) {
                return <p key={j} className={styles.reportBullet}>• {line.slice(2)}</p>
              }
              if (line.trim()) {
                return <p key={j} className={styles.reportParagraph}>{line}</p>
              }
              return null
            })}
          </div>
        </div>
      )
    })
  }

  const closedTrades = trades.filter(t => !t.is_open && t.pnl != null)

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <Sidebar userEmail={user?.email || ''} />

      <main className={styles.main}>
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <span className={styles.pageTitle}>AI Coach</span>
            <span className={styles.pageSubtitle}>Powered by Claude — brutally honest analysis of your trading</span>
          </div>
        </div>

        <div className={styles.content}>

          {closedTrades.length < 3 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🤖</span>
              <h3>Need more trades</h3>
              <p>Log at least 3 closed trades before the AI can analyze your patterns.</p>
            </div>
          ) : (
            <>
              {/* Analyze Card */}
              {!report && (
                <div className={styles.analyzeCard}>
                  <div className={styles.analyzeCardLeft}>
                    <div className={styles.analyzeIcon}>🤖</div>
                    <div>
                      <h2 className={styles.analyzeTitle}>Ready to analyze your trading</h2>
                      <p className={styles.analyzeSub}>
                        Based on your {closedTrades.length} closed trades — Claude will find patterns,
                        identify your biggest mistakes, and tell you exactly what to fix.
                      </p>
                    </div>
                  </div>

                  <div className={styles.analyzeActions}>
                    <button
                      onClick={() => setShowStrategyInput(!showStrategyInput)}
                      className={styles.btnGhost}
                    >
                      {showStrategyInput ? 'Hide' : '+ Add'} strategy context
                    </button>
                    <button
                      onClick={handleAnalyze}
                      className={styles.btnAnalyze}
                      disabled={analyzing}
                    >
                      {analyzing ? (
                        <span className={styles.analyzingText}>
                          <span className={styles.analyzeSpinner} />
                          Analyzing your trades...
                        </span>
                      ) : '🤖 Analyze My Trading'}
                    </button>
                  </div>

                  {showStrategyInput && (
                    <div className={styles.strategyInput}>
                      <label className={styles.strategyLabel}>
                        Describe your strategy (optional but makes analysis much better)
                      </label>
                      <textarea
                        value={userStrategy}
                        onChange={e => setUserStrategy(e.target.value)}
                        placeholder="e.g. I trade MNQ, I look for VWAP reclaims and order flow setups during RTH. I try to risk 1R and target 2-3R. I trade the first 2 hours of RTH mainly..."
                        className={styles.strategyTextarea}
                        rows={4}
                      />
                    </div>
                  )}

                  {error && <div className={styles.error}>{error}</div>}
                </div>
              )}

              {/* Report */}
              {report && (
                <div className={styles.reportCard}>
                  <div className={styles.reportHeader}>
                    <div>
                      <h2 className={styles.reportTitle}>🤖 Your Coaching Report</h2>
                      <p className={styles.reportSubtitle}>
                        Based on {closedTrades.length} closed trades • Generated just now
                      </p>
                    </div>
                    <button
                      onClick={() => { setReport(null); setShowStrategyInput(false) }}
                      className={styles.btnGhost}
                    >
                      Run New Analysis
                    </button>
                  </div>
                  <div className={styles.reportBody}>
                    {formatReport(report)}
                  </div>
                </div>
              )}

              {/* Past Reports */}
              {pastReports.length > 0 && !report && (
                <div className={styles.pastReports}>
                  <h3 className={styles.pastReportsTitle}>Past Reports</h3>
                  <div className={styles.pastReportsList}>
                    {pastReports.map(r => (
                      <div key={r.id} className={styles.pastReportCard} onClick={() => setReport(r.report)}>
                        <div className={styles.pastReportLeft}>
                          <span className={styles.pastReportIcon}>📋</span>
                          <div>
                            <span className={styles.pastReportDate}>
                              {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className={styles.pastReportTrades}>{r.trade_count} trades analyzed</span>
                          </div>
                        </div>
                        <span className={styles.pastReportArrow}>→</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}