import { NextResponse } from 'next/server';
import { redis, QUEUE, keys, touch, onlineCount } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    await touch(userId);
    await redis.del(keys.pair(userId));

    let partner = null;
    for (let i = 0; i < 25; i++) {
      const cand = await redis.lpop(QUEUE);
      if (!cand) break;
      if (String(cand) === String(userId)) continue;

      const [alive, taken] = await Promise.all([
        redis.get(keys.alive(cand)),
        redis.get(keys.pair(cand)),
      ]);
      if (alive && !taken) {
        partner = String(cand);
        break;
      }
    }

    if (partner) {
      const roomId = crypto.randomUUID();
      await Promise.all([
        redis.set(keys.pair(userId), { roomId, partnerId: partner }, { ex: 3600 }),
        redis.set(keys.pair(partner), { roomId, partnerId: userId }, { ex: 3600 }),
        redis.del(keys.ended(roomId)),
      ]);
      return NextResponse.json({
        status: 'matched',
        roomId,
        partnerId: partner,
        online: await onlineCount(),
      });
    }

    await redis.rpush(QUEUE, userId);
    await redis.expire(QUEUE, 300);
    return NextResponse.json({ status: 'waiting', online: await onlineCount() });
  } catch (error) {
    console.error('Match error:', error);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
