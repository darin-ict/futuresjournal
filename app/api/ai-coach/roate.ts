import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { trades, userStrategy } = await req.json()

    if (!trades || trades.length < 3) {
      return NextResponse.json({ error: 'Need at least 3 trades for analysis' }, { status: 400 })
    }

    const closedTrades = trades.filter((t: any) => !t.is_open && t.pnl != null)
    const winners = closedTrades.filter((t: any) => t.pnl > 0)
    const losers = closedTrades.filter((t: any) => t.pnl < 0)
    const totalPnl = closedTrades.reduce((s: number, t: any) => s + t.pnl, 0)
    const winRate = closedTrades.length > 0 ? (winners.length / closedTrades.length * 100).toFixed(1) : 0
    const avgWin = winners.length > 0 ? (winners.reduce((s: number, t: any) => s + t.pnl, 0) / winners.length).toFixed(2) : 0
    const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s: number, t: any) => s + t.pnl, 0) / losers.length).toFixed(2) : 0

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const byDay: Record<string, { pnl: number; count: number; wins: number }> = {}
    dayNames.forEach(d => { byDay[d] = { pnl: 0, count: 0, wins: 0 } })
    closedTrades.forEach((t: any) => {
      const day = dayNames[new Date(t.entry_time).getDay()]
      byDay[day].pnl += t.pnl
      byDay[day].count++
      if (t.pnl > 0) byDay[day].wins++
    })

    const byHour: Record<number, { pnl: number; count: number }> = {}
    closedTrades.forEach((t: any) => {
      const hour = new Date(t.entry_time).getHours()
      if (!byHour[hour]) byHour[hour] = { pnl: 0, count: 0 }
      byHour[hour].pnl += t.pnl
      byHour[hour].count++
    })

    const bySetup: Record<string, { pnl: number; count: number; wins: number }> = {}
    closedTrades.forEach((t: any) => {
      const k = t.setup_tag || 'Untagged'
      if (!bySetup[k]) bySetup[k] = { pnl: 0, count: 0, wins: 0 }
      bySetup[k].pnl += t.pnl
      bySetup[k].count++
      if (t.pnl > 0) bySetup[k].wins++
    })

    const byMistake: Record<string, { pnl: number; count: number }> = {}
    closedTrades.filter((t: any) => t.mistake_tag).forEach((t: any) => {
      if (!byMistake[t.mistake_tag]) byMistake[t.mistake_tag] = { pnl: 0, count: 0 }
      byMistake[t.mistake_tag].pnl += t.pnl
      byMistake[t.mistake_tag].count++
    })

    let maxConsecLosses = 0, curLosses = 0
    const tradeAfterConsecLoss = { count: 0, wins: 0 }
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

    const dataSummary = `
TRADER PERFORMANCE DATA:
- Total closed trades: ${closedTrades.length}
- Total P&L: $${totalPnl.toFixed(2)}
- Win rate: ${winRate}%
- Avg winner: $${avgWin}
- Avg loser: $${avgLoss}
- Profit factor: ${parseFloat(avgLoss as string) > 0 ? (parseFloat(avgWin as string) / parseFloat(avgLoss as string)).toFixed(2) : 'N/A'}
- Max consecutive losses: ${maxConsecLosses}
- Trades after 2+ consecutive losses: ${tradeAfterConsecLoss.count} (${tradeAfterConsecLoss.count > 0 ? Math.round(tradeAfterConsecLoss.wins / tradeAfterConsecLoss.count * 100) : 0}% win rate)

PERFORMANCE BY DAY:
${Object.entries(byDay).filter(([, d]) => d.count > 0).map(([day, d]) => `- ${day}: ${d.count} trades, ${Math.round(d.wins / d.count * 100)}% WR, $${d.pnl.toFixed(2)} P&L`).join('\n')}

PERFORMANCE BY HOUR:
${Object.entries(byHour).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([hour, d]) => `- ${hour}:00: ${d.count} trades, $${d.pnl.toFixed(2)} P&L`).join('\n')}

PERFORMANCE BY SETUP:
${Object.entries(bySetup).map(([setup, d]) => `- ${setup}: ${d.count} trades, ${Math.round(d.wins / d.count * 100)}% WR, $${d.pnl.toFixed(2)} P&L`).join('\n')}

MISTAKE ANALYSIS:
${Object.entries(byMistake).length > 0 ? Object.entries(byMistake).map(([mistake, d]) => `- ${mistake}: ${d.count} times, $${d.pnl.toFixed(2)} total cost`).join('\n') : 'No mistakes tagged yet'}

${userStrategy ? `TRADER STRATEGY: ${userStrategy}` : ''}
`

    const prompt = `You are an elite futures trading coach with 20 years of experience. Analyze this trader's data and give brutally honest, specific, actionable feedback.

${dataSummary}

Structure your response exactly like this:

## 🎯 Overall Assessment
2-3 sentences on where this trader stands. Be direct.

## 💪 What's Working
2-3 specific things backed by exact numbers.

## 🚨 Critical Issues
The 2-3 biggest problems hurting their P&L. Use exact numbers. Be brutal but constructive.

## 🧠 Psychology Patterns
What the data reveals about their psychology. Look for revenge trading, FOMO, overtrading.

## ⏰ Timing Analysis
When they should and shouldn't trade based on the data.

## 📋 Setup Analysis
Which setups make money and which don't.

## 🎯 This Week's Action Plan
3 specific concrete things to do THIS WEEK. Not generic — specific to their data.`

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const responseText = await response.text()

    if (!response.ok) {
      return NextResponse.json({
        error: `Anthropic API error ${response.status}: ${responseText.slice(0, 200)}`
      }, { status: 500 })
    }

    const data = JSON.parse(responseText)
    const report = data.content?.[0]?.text

    if (!report) {
      return NextResponse.json({
        error: `No content returned: ${responseText.slice(0, 200)}`
      }, { status: 500 })
    }

    return NextResponse.json({ report })

  } catch (error: any) {
    console.error('AI Coach error:', error)
    return NextResponse.json({
      error: `Server error: ${error.message || 'Unknown error'}`
    }, { status: 500 })
  }
}