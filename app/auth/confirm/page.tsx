'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import styles from './confirm.module.css'

export default function ConfirmPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setStatus('success')
      } else {
        // Give it a moment for the auth to process
        setTimeout(async () => {
          const { data: { session: s2 } } = await supabase.auth.getSession()
          setStatus(s2 ? 'success' : 'error')
        }, 2000)
      }
    }
    checkSession()
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        padding: '48px',
        width: '100%',
        maxWidth: '440px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ fontSize: '32px', color: 'var(--accent)' }}>◈</div>

        {status === 'loading' && (
          <>
            <div style={{
              width: '40px', height: '40px',
              border: '3px solid var(--border)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            <h2 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '700', margin: 0 }}>
              Confirming your email...
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
              Just a second
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: '64px', height: '64px',
              borderRadius: '50%',
              background: 'rgba(0,212,170,0.15)',
              border: '2px solid var(--accent-green)',
              color: 'var(--accent-green)',
              fontSize: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>✓</div>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
              Email confirmed!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
              Your account is ready. Let's start building your trading edge.
            </p>
            <Link href="/dashboard" style={{
              display: 'inline-block',
              background: 'var(--accent)',
              color: 'white',
              padding: '14px 32px',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '700',
              textDecoration: 'none',
              marginTop: '8px'
            }}>
              Go to Dashboard →
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: '64px', height: '64px',
              borderRadius: '50%',
              background: 'rgba(255,71,87,0.15)',
              border: '2px solid var(--accent-red)',
              color: 'var(--accent-red)',
              fontSize: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>✕</div>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '800', margin: 0 }}>
              Link expired
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
              This confirmation link has expired or already been used. Try signing in or request a new link.
            </p>
            <Link href="/login" style={{
              display: 'inline-block',
              background: 'var(--accent)',
              color: 'white',
              padding: '14px 32px',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '700',
              textDecoration: 'none',
              marginTop: '8px'
            }}>
              Go to Login
            </Link>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}