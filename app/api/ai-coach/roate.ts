import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { trades, userStrategy } = await req.json()

  if (!trades || trades.length < 3) {
    return NextResponse.json({ error: 'Need at least 3 trades for analysis' }, { status: 400 })
  }

  // Build trade summary for Claude
  const closedTrades = trades.filter((t: any) => !t.is_open && t.pnl != null)
  const winners = closedTrades.filter((t: any) => t.pnl > 0)
  const losers = closedTrades.filter((t: any) => t.pnl < 0)
  const totalPnl = closedTrades.reduce((s: number, t: any) => s + t.pnl, 0)
  const winRate = closedTrades.length > 0 ? (winners.length / closedTrades.length * 100).toFixed(1) : 0
  const avgWin = winners.length > 0 ? (winners.reduce((s: number, t: any) => s + t.pnl, 0) / winners.length).toFixed(2) : 0
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s: number, t: any) => s + t.pnl, 0) / losers.length).toFixed(2) : 0

  // P&L by day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const byDay: Record<string, { pnl: number; count: number; wins: number }> = {}
  dayNames.forEach(d => { byDay[d] = { pnl: 0, count: 0, wins: 0 } })
  closedTrades.forEach((t: any) => {
    const day = dayNames[new Date(t.entry_time).getDay()]
    byDay[day].pnl += t.pnl
    byDay[day].count++
    if (t.pnl > 0) byDay[day].wins++
  })

  // P&L by hour
  const byHour: Record<number, { pnl: number; count: number }> = {}
  closedTrades.forEach((t: any) => {
    const hour = new Date(t.entry_time).getHours()
    if (!byHour[hour]) byHour[hour] = { pnl: 0, count: 0 }
    byHour[hour].pnl += t.pnl
    byHour[hour].count++
  })

  // By setup
  const bySetup: Record<string, { pnl: number; count: number; wins: number }> = {}
  closedTrades.forEach((t: any) => {
    const k = t.setup_tag || 'Untagged'
    if (!bySetup[k]) bySetup[k] = { pnl: 0, count: 0, wins: 0 }
    bySetup[k].pnl += t.pnl
    bySetup[k].count++
    if (t.pnl > 0) bySetup[k].wins++
  })

  // Mistake analysis
  const byMistake: Record<string, { pnl: number; count: number }> = {}
  closedTrades.filter((t: any) => t.mistake_tag).forEach((t: any) => {
    if (!byMistake[t.mistake_tag]) byMistake[t.mistake_tag] = { pnl: 0, count: 0 }
    byMistake[t.mistake_tag].pnl += t.pnl
    byMistake[t.mistake_tag].count++
  })

  // Consecutive loss detection
  let maxConsecLosses = 0, curLosses = 0
  let tradeAfterConsecLoss = { count: 0, wins: 0 }
  closedTrades.forEach((t: any, i: number) => {
    if (t.pnl < 0) {
      curLosses++
      maxConsecLosses = Math.max(maxConsecLosses, curLosses)
    } else {
      if (curLosses >= 2 && i > 0) {
        tradeAfterConsecLoss.count++
        if (t.pnl > 0) tradeAfterConsecLoss.wins++
      }
      curLosses = 0
    }
  })

  // Build the data summary
  const dataSummary = `
TRADER PERFORMANCE DATA:
- Total closed trades: ${closedTrades.length}
- Total P&L: $${totalPnl.toFixed(2)}
- Win rate: ${winRate}%
- Avg winner: $${avgWin}
- Avg loser: $${avgLoss}
- Profit factor: ${parseFloat(avgLoss as string) > 0 ? (parseFloat(avgWin as string) / parseFloat(avgLoss as string)).toFixed(2) : 'N/A'}
- Max consecutive losses: ${maxConsecLosses}
- Trades taken after 2+ consecutive losses: ${tradeAfterConsecLoss.count} (${tradeAfterConsecLoss.count > 0 ? Math.round(tradeAfterConsecLoss.wins / tradeAfterConsecLoss.count * 100) : 0}% win rate - potential revenge trading indicator)

PERFORMANCE BY DAY:
${Object.entries(byDay).filter(([_, d]) => d.count > 0).map(([day, d]) => `- ${day}: ${d.count} trades, ${Math.round(d.wins/d.count*100)}% WR, $${d.pnl.toFixed(2)} P&L`).join('\n')}

PERFORMANCE BY HOUR (24h):
${Object.entries(byHour).sort((a,b) => parseInt(a[0])-parseInt(b[0])).map(([hour, d]) => `- ${hour}:00: ${d.count} trades, $${d.pnl.toFixed(2)} P&L`).join('\n')}

PERFORMANCE BY SETUP:
${Object.entries(bySetup).map(([setup, d]) => `- ${setup}: ${d.count} trades, ${Math.round(d.wins/d.count*100)}% WR, $${d.pnl.toFixed(2)} P&L`).join('\n')}

MISTAKE ANALYSIS:
${Object.entries(byMistake).length > 0 ? Object.entries(byMistake).map(([mistake, d]) => `- ${mistake}: ${d.count} times, $${d.pnl.toFixed(2)} total cost`).join('\n') : 'No mistakes tagged yet'}

${userStrategy ? `TRADER'S STRATEGY DESCRIPTION: ${userStrategy}` : ''}
`

  const prompt = `You are an elite futures trading coach with 20 years of experience. You have access to a trader's complete performance data. Your job is to give them the most brutally honest, specific, and actionable analysis possible.

${dataSummary}

Write a comprehensive coaching report. Be specific with numbers. Be honest even if it's harsh. Structure your response exactly like this:

## 🎯 Overall Assessment
2-3 sentences on where this trader stands right now. Be direct.

## 💪 What's Working
2-3 specific things backed by the data with exact numbers.

## 🚨 Critical Issues
The 2-3 biggest problems hurting their P&L. Use exact numbers. Be brutal but constructive.

## 🧠 Psychology Patterns
What the data reveals about their trading psychology. Look for revenge trading, overtrading, FOMO patterns in the data.

## ⏰ Timing Analysis  
When they should and shouldn't be trading based on the data. Be specific about days and hours.

## 📋 Setup Analysis
Which setups are making money and which aren't. What they should focus on.

## 🎯 This Week's Action Plan
3 specific, concrete things to do THIS WEEK to improve. Not generic advice — specific to their data.

Keep each section concise but impactful. Use the exact numbers from the data. This trader needs real talk, not encouragement fluff.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json({ 
      error: `API Error: ${data.error?.message || JSON.stringify(data)}` 
    }, { status: 500 })
  }

  if (!data.content || !data.content[0]) {
    return NextResponse.json({ 
      error: `Unexpected response: ${JSON.stringify(data)}` 
    }, { status: 500 })
  }

  const report = data.content[0].text

  return NextResponse.json({ report })
}