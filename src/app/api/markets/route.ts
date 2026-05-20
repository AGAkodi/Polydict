import { NextResponse } from 'next/server';
import { getMergedMarkets } from '../../../utils/polymarket';

// Next.js segment config to revalidate route every 24 hours
export const revalidate = 86400;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'all';

  try {
    const markets = await getMergedMarkets(category);
    return NextResponse.json(markets, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
      },
    });
  } catch (err: any) {
    console.error('Error in /api/markets route:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
