import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DEMO_URL = 'https://demo.tradovateapi.com/v1'

async function getTradovateToken(username: string, password: string, isDemo: boolean) {
  const baseUrl = isDemo ? DEMO_URL : 'https://live.tradovateapi.com/v1'
  
  const res = await fetch(`${baseUrl}/auth/accesstokenrequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: username,
      password: password,
      appId: 'FuturesJournal',
      appVersion: '1.0',
      cid: 0,
      sec: '',
    }),
  })

  const data = await res.json()
  
  if (data.errorText) throw new Error(data.errorText)
  if (!data.accessToken) throw new Error('No access token received')
  
  return data.accessToken
}

async function getTradovateAccounts(token: string, isDemo: boolean) {
  const baseUrl = isDemo ? DEMO_URL : 'https://live.tradovateapi.com/v1'
  
  const res = await fetch(`${baseUrl}/account/list`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  return await res.json()
}

async function getTradovateFills(token: string, accountId: number, isDemo: boolean) {
  const baseUrl = isDemo ? DEMO_URL : 'https://live.tradovateapi.com/v1'
  
  const res = await fetch(`${baseUrl}/execution/list`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  return await res.json()
}

export async function POST(req: NextRequest) {
  const { action, userId, username, password, isDemo } = await req.json()

  try {
    if (action === 'connect') {
      // Get token
      const token = await getTradovateToken(username, password, isDemo)
      
      // Get accounts
      const accounts = await getTradovateAccounts(token, isDemo)
      
      if (!accounts || accounts.length === 0) {
        return NextResponse.json({ error: 'No accounts found' }, { status: 400 })
      }

      const account = accounts[0]

      // Save connection to DB
      const { error } = await supabaseAdmin
        .from('tradovate_connections')
        .upsert({
          user_id: userId,
          username,
          password,
          account_id: account.id,
          account_name: account.name,
          is_demo: isDemo,
          access_token: token,
          token_expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'user_id' })

      if (error) throw error

      return NextResponse.json({ 
        success: true, 
        accountName: account.name,
        accountId: account.id 
      })
    }

    if (action === 'sync') {
      // Get connection from DB
      const { data: conn } = await supabaseAdmin
        .from('tradovate_connections')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (!conn) return NextResponse.json({ error: 'No connection found' }, { status: 400 })

      // Get fresh token
      const token = await getTradovateToken(conn.username, conn.password, conn.is_demo)

      // Get fills
      const fills = await getTradovateFills(token, conn.account_id, conn.is_demo)

      if (!fills || !Array.isArray(fills)) {
        return NextResponse.json({ synced: 0, message: 'No fills found' })
      }

      // Get existing trades to avoid duplicates
      const { data: existingTrades } = await supabaseAdmin
        .from('trades')
        .select('id, entry_time, entry_price, instrument')
        .eq('user_id', userId)

      // Process fills into matched trades (buy + sell pairs)
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

      const getBase = (symbol: string) => {
        const s = symbol.toUpperCase()
        const bases = ['MNQ', 'MES', 'MCL', 'ES', 'NQ', 'CL', 'GC', 'SI', 'ZB', 'ZN', 'RTY', 'YM']
        for (const key of bases) {
          if (s.startsWith(key)) return key
        }
        return s.replace(/[A-Z]\d+$/, '') || s
      }

      // Group fills by contract symbol
      const bySymbol: Record<string, any[]> = {}
      fills.forEach((fill: any) => {
        const sym = fill.contractId?.name || fill.symbol || 'UNKNOWN'
        if (!bySymbol[sym]) bySymbol[sym] = []
        bySymbol[sym].push(fill)
      })

      let synced = 0
      const tradesToInsert: any[] = []

      for (const [symbol, symFills] of Object.entries(bySymbol)) {
        const base = getBase(symbol)
        const tickValue = tickValues[base] || 12.50
        const tickSize = tickSizes[base] || 0.25

        // Separate buys and sells
        const buys = symFills.filter((f: any) => f.action === 'Buy').sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        const sells = symFills.filter((f: any) => f.action === 'Sell').sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

        // Match pairs
        const pairs = Math.min(buys.length, sells.length)
        for (let i = 0; i < pairs; i++) {
          const buy = buys[i]
          const sell = sells[i]
          
          const entryTime = new Date(buy.timestamp).toISOString()
          const exitTime = new Date(sell.timestamp).toISOString()
          const entryPrice = buy.price
          const exitPrice = sell.price
          const qty = Math.min(buy.qty, sell.qty)

          // Check if already exists
          const exists = existingTrades?.some(t => 
            Math.abs(new Date(t.entry_time).getTime() - new Date(entryTime).getTime()) < 60000 &&
            t.entry_price === entryPrice &&
            t.instrument === base
          )

          if (!exists) {
            const priceDiff = exitPrice - entryPrice
            const ticks = priceDiff / tickSize
            const pnl = parseFloat((ticks * tickValue * qty).toFixed(2))

            tradesToInsert.push({
              user_id: userId,
              instrument: base,
              direction: 'LONG',
              entry_price: entryPrice,
              exit_price: exitPrice,
              contracts: qty,
              entry_time: entryTime,
              exit_time: exitTime,
              pnl,
              is_open: false,
              session: 'RTH',
              emotional_state: 3,
            })
            synced++
          }
        }

        // Also check sell-first (SHORT) pairs
        if (sells.length > buys.length) {
          for (let i = 0; i < sells.length - buys.length; i++) {
            const sell = sells[i]
            const buy = buys[i] || buys[buys.length - 1]
            if (!buy) continue

            const entryTime = new Date(sell.timestamp).toISOString()
            const exitTime = new Date(buy.timestamp).toISOString()
            const entryPrice = sell.price
            const exitPrice = buy.price
            const qty = Math.min(sell.qty, buy.qty)

            const exists = existingTrades?.some(t =>
              Math.abs(new Date(t.entry_time).getTime() - new Date(entryTime).getTime()) < 60000 &&
              t.entry_price === entryPrice &&
              t.instrument === base
            )

            if (!exists) {
              const priceDiff = entryPrice - exitPrice
              const ticks = priceDiff / tickSize
              const pnl = parseFloat((ticks * tickValue * qty).toFixed(2))

              tradesToInsert.push({
                user_id: userId,
                instrument: base,
                direction: 'SHORT',
                entry_price: entryPrice,
                exit_price: exitPrice,
                contracts: qty,
                entry_time: entryTime,
                exit_time: exitTime,
                pnl,
                is_open: false,
                session: 'RTH',
                emotional_state: 3,
              })
              synced++
            }
          }
        }
      }

      if (tradesToInsert.length > 0) {
        await supabaseAdmin.from('trades').insert(tradesToInsert)
      }

      // Update last synced time
      await supabaseAdmin
        .from('tradovate_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('user_id', userId)

      return NextResponse.json({ synced, message: `${synced} new trades imported` })
    }

    if (action === 'disconnect') {
      await supabaseAdmin
        .from('tradovate_connections')
        .delete()
        .eq('user_id', userId)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (error: any) {
    console.error('Tradovate error:', error)
    return NextResponse.json({ error: error.message || 'Connection failed' }, { status: 500 })
  }
}