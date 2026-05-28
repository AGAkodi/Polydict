import { NextResponse } from 'next/server';
import { fetchHttp1 } from '../../../utils/polymarket';

export async function GET() {
  try {
    // Zero cache live telemetry - strictly direct fetch from Polymarket CLOB API
    const rawData = await fetchHttp1('https://clob.polymarket.com/markets');
    const parsed = JSON.parse(rawData);

    // Standardize structure since CLOB API returns either a raw list or wrapped data object
    const clobMarkets = Array.isArray(parsed) ? parsed : (parsed?.data ?? []);

    if (!Array.isArray(clobMarkets) || clobMarkets.length === 0) {
      throw new Error('Polymarket CLOB API did not return standard markets data.');
    }

    const priceMap: Record<string, { yes: number; no: number; vol: number }> = {};
    
    for (const m of clobMarkets) {
      if (!m.condition_id) continue;

      const yesTokenObj = m.tokens?.find((t: any) => t.outcome?.toLowerCase() === 'yes');
      const noTokenObj = m.tokens?.find((t: any) => t.outcome?.toLowerCase() === 'no');

      const yesPrice = yesTokenObj ? parseFloat(yesTokenObj.price) : parseFloat(m.tokens?.[0]?.price ?? 0.5);
      const noPrice = noTokenObj ? parseFloat(noTokenObj.price) : parseFloat(m.tokens?.[1]?.price ?? 0.5);
      const volume = parseFloat(m.volume ?? 0);

      priceMap[m.condition_id] = {
        yes: yesPrice,
        no: noPrice,
        vol: volume,
      };
    }

    // Return the slim map with strict no-cache headers to enforce zero CDN/browser caching
    return new NextResponse(JSON.stringify(priceMap), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err: any) {
    console.error('Failed to fetch real-time prices from CLOB:', err);
    return new NextResponse(
      JSON.stringify({ error: err.message || 'Polymarket CLOB API unreachable' }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  }
}
