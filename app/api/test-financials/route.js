export async function GET() {
  const key = process.env.POLYGON_API_KEY
  if (!key) return Response.json({ error: 'No hay POLYGON_API_KEY en env' })
  const res = await fetch(`https://api.polygon.io/vX/reference/financials?ticker=NVDA&limit=1&timeframe=quarterly&sort=period_of_report_date&order=desc&apiKey=${key}`)
  const data = await res.json()
  return Response.json({ status: data.status, count: data.results?.length, first: data.results?.[0]?.financials?.balance_sheet?.equity })
}
