import { NextResponse } from 'next/server';
import { redis, keys, touch, onlineCount, parseMsg } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const roomId = searchParams.get('roomId');
    const partnerId = searchParams.get('partnerId');
    const cursor = parseInt(searchParams.get('cursor') || '0', 10);

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    await touch(userId);
    const online = await onlineCount();

    if (!roomId) {
      const pair = await redis.get(keys.pair(userId));
      if (pair) {
        return NextResponse.json({
          status: 'matched',
          roomId: pair.roomId,
          partnerId: pair.partnerId,
          online,
        });
      }
      return NextResponse.json({ status: 'waiting', online });
    }

    const [ended, raw, typing] = await Promise.all([
      redis.get(keys.ended(roomId)),
      redis.lrange(keys.msgs(roomId), cursor, -1),
      partnerId ? redis.get(keys.typing(roomId, partnerId)) : null,
    ]);

    const messages = (raw || []).map(parseMsg);

    return NextResponse.json({
      status: ended ? 'ended' : 'chatting',
      messages,
      cursor: cursor + messages.length,
      partnerTyping: Boolean(typing),
      online,
    });
  } catch (error) {
    console.error('Poll error:', error);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
