import { NextRequest, NextResponse } from 'next/server';
import { getMergedMarkets } from '../../../utils/polymarket';

export const dynamic = 'force-dynamic';
export const revalidate = 86400;

export async function GET(req: NextRequest) {
  try {
    const category = req.nextUrl.searchParams.get('category') ?? 'all';
    const merged = await getMergedMarkets(category);
    return NextResponse.json(merged);
  } catch (err: any) {
    console.error('Error in /api/markets GET route:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve Polymarket metadata.' },
      { status: 502 }
    );
  }
}