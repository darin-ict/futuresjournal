'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

export default function SharePage() {
  const params = useParams()
  const [trade, setTrade] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTrade = async () => {
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('id', params.id)
        .eq('is_public', true)
        .single()
      setTrade(data)
      setLoading(false)
    }
    fetchTrade()
  }, [params.id])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px', margin: '0 auto 16px',
            border: '3px solid #2a2a40', borderTopColor: '#6c63ff',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: '#606080', fontSize: '14px' }}>Loading trade...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  if (!trade) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}>
        <div style={{ textAlign: 'center', color: '#606080' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>◈</div>
          <h2 style={{ color: '#ffffff', fontSize: '20px', marginBottom: '8px' }}>Trade not found</h2>
          <p style={{ fontSize: '14px', marginBottom: '24px' }}>This trade is private or doesn't exist.</p>
          <Link href="/" style={{
            background: '#6c63ff', color: 'white', padding: '12px 24px',
            borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600'
          }}>
            Go to FuturesJournal
          </Link>
        </div>
      </div>
    )
  }

  const isWin = trade.pnl > 0
  const isLoss = trade.pnl < 0

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <div style={{
          background: '#12121a',
          border: `1px solid ${isWin ? 'rgba(0,212,170,0.3)' : isLoss ? 'rgba(255,71,87,0.3)' : '#2a2a40'}`,
          borderRadius: '20px', overflow: 'hidden',
        }}>
          <div style={{ height: '4px', background: isWin ? '#00d4aa' : isLoss ? '#ff4757' : '#6c63ff' }} />

          <div style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.5px' }}>
                  {trade.instrument}
                </span>
                <span style={{
                  fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '6px',
                  background: trade.direction === 'LONG' ? 'rgba(0,212,170,0.12)' : 'rgba(255,71,87,0.12)',
                  color: trade.direction === 'LONG' ? '#00d4aa' : '#ff4757',
                }}>
                  {trade.direction}
                </span>
              </div>
              <span style={{ fontSize: '13px', color: '#606080' }}>
                {new Date(trade.entry_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <div style={{ marginBottom: '28px', textAlign: 'center', padding: '24px', background: '#0a0a0f', borderRadius: '14px' }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#606080', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>
                Realized P&L
              </p>
              <p style={{
                fontSize: '56px', fontWeight: '900', margin: '0',
                letterSpacing: '-2px', lineHeight: '1',
                color: isWin ? '#00d4aa' : isLoss ? '#ff4757' : '#ffffff',
              }}>
                {trade.pnl > 0 ? '+' : ''}${trade.pnl.toFixed(2)}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'Entry', value: trade.entry_price },
                { label: 'Exit', value: trade.exit_price ?? '—' },
                { label: 'Contracts', value: trade.contracts },
                { label: 'Session', value: trade.session || 'RTH' },
              ].map((s, i) => (
                <div key={i} style={{ background: '#1a1a26', borderRadius: '10px', padding: '14px' }}>
                  <p style={{ fontSize: '11px', color: '#606080', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', margin: '0 0 4px' }}>
                    {s.label}
                  </p>
                  <p style={{ fontSize: '16px', fontWeight: '700', color: '#ffffff', margin: '0' }}>{s.value}</p>
                </div>
              ))}
            </div>

            {trade.setup_tag && (
              <div style={{ marginBottom: '16px' }}>
                <span style={{
                  fontSize: '13px', fontWeight: '600',
                  background: 'rgba(108,99,255,0.12)', color: '#6c63ff',
                  padding: '6px 14px', borderRadius: '20px',
                }}>
                  {trade.setup_tag}
                </span>
              </div>
            )}

            {trade.notes && (
              <div style={{ background: '#1a1a26', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', color: '#606080', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', margin: '0 0 8px' }}>
                  📝 Notes
                </p>
                <p style={{ fontSize: '14px', color: '#a0a0b8', lineHeight: '1.6', margin: '0' }}>{trade.notes}</p>
              </div>
            )}

            {trade.screenshot_url && (
              <img src={trade.screenshot_url} alt="Trade chart"
                style={{ width: '100%', borderRadius: '10px', border: '1px solid #2a2a40' }} />
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px', color: '#6c63ff' }}>◈</span>
              <span style={{ fontSize: '15px', fontWeight: '700', color: '#a0a0b8' }}>FuturesJournal</span>
            </div>
          </Link>
          <p style={{ fontSize: '12px', color: '#606080', margin: '6px 0 0' }}>
            Track your trades. Find your edge. Trade better.
          </p>
          <Link href="/signup" style={{
            display: 'inline-block', marginTop: '12px',
            background: '#6c63ff', color: 'white',
            padding: '10px 24px', borderRadius: '8px',
            fontSize: '13px', fontWeight: '600', textDecoration: 'none',
          }}>
            Start journaling free →
          </Link>
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}