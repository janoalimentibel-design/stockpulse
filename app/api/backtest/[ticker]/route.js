import { supabase } from '@/lib/supabase'
import { validateTicker } from '@/lib/validate'
import { goldenCross } from '@/lib/backtest/golden-cross'
import { rsiOversold } from '@/lib/backtest/rsi-oversold'
import { macdBull } from '@/lib/backtest/macd-bull'

export async function GET(request, { params }) {
  try {
    const ticker = validateTicker(params.ticker)
    if (!ticker) return Response.json({ error: 'Ticker inválido.' }, { status: 400 })

    if (!supabase) return Response.json({ error: 'Base de datos no configurada.' }, { status: 500 })

    const { data, error } = await supabase
      .from('ohlcv_daily')
      .select('date, open, high, low, close, volume')
      .eq('ticker', ticker)
      .order('date', { ascending: true })

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) {
      return Response.json({ error: 'Sin datos históricos para este ticker.' }, { status: 404 })
    }

    const [gc, rsi, macd] = await Promise.all([
      Promise.resolve(goldenCross(data, ticker)),
      Promise.resolve(rsiOversold(data, ticker)),
      Promise.resolve(macdBull(data, ticker)),
    ])

    return Response.json({
      ticker,
      dataPoints: data.length,
      fromDate: data[0].date,
      toDate: data[data.length - 1].date,
      setups: {
        goldenCross: gc,
        rsiOversold: rsi,
        macdBull: macd,
      },
    })
  } catch (err) {
    console.error('[backtest]', err?.message)
    return Response.json({ error: 'Error al calcular backtesting.' }, { status: 500 })
  }
}
