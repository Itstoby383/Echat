import { NextResponse } from 'next/server';
import { redis, keys } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { userId, roomId } = await req.json();
    if (!userId || !roomId) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

    await redis.set(keys.typing(roomId, userId), 1, { ex: 4 });
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Typing error:', error);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
