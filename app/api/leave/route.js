import { NextResponse } from 'next/server';
import { redis, QUEUE, ONLINE, keys } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { userId, roomId, partnerId, quit } = await req.json();

    if (roomId) await redis.set(keys.ended(roomId), 1, { ex: 3600 });
    if (userId) await redis.del(keys.pair(userId));
    if (partnerId) await redis.del(keys.pair(partnerId));
    if (userId) await redis.lrem(QUEUE, 0, userId);

    if (quit && userId) {
      await redis.del(keys.alive(userId));
      await redis.zrem(ONLINE, userId);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Leave error:', error);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
