import { NextResponse } from 'next/server';
import { redis, keys, touch } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { userId, roomId, text } = await req.json();
    if (!userId || !roomId || !text) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 });
    }

    await touch(userId);

    const ended = await redis.get(keys.ended(roomId));
    if (ended) return NextResponse.json({ status: 'ended' });

    const clean = String(text).slice(0, 1000);
    await redis.rpush(keys.msgs(roomId), {
      from: userId,
      text: clean,
      ts: Date.now(),
    });
    await redis.expire(keys.msgs(roomId), 3600);
    await redis.del(keys.typing(roomId, userId));

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Send error:', error);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
