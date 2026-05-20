import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getMergedMarkets } from '../../../../utils/polymarket';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';

    // Bust the Next.js cache tagged with 'markets' on-demand
    revalidateTag('markets', 'max');


    // Fetch the fresh category list
    const markets = await getMergedMarkets(category);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      markets,
    });
  } catch (err: any) {
    console.error('Error in /api/markets/refresh:', err);
    return NextResponse.json({ error: err.message || 'Refresh failed' }, { status: 500 });
  }
}
