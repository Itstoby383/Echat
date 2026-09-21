import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  console.warn('Warning: Redis env vars not set. Chat will not work. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
}

export const redis = new Redis({ url, token });

export const QUEUE = 'echat:queue';
export const ONLINE = 'echat:online';

export const keys = {
  alive: (id) => `echat:alive:${id}`,
  pair: (id) => `echat:pair:${id}`,
  msgs: (room) => `echat:room:${room}:msgs`,
  ended: (room) => `echat:room:${room}:ended`,
  typing: (room, id) => `echat:typing:${room}:${id}`,
};

export async function touch(userId) {
  const now = Date.now();
  await Promise.all([
    redis.set(keys.alive(userId), 1, { ex: 30 }),
    redis.zadd(ONLINE, { score: now, member: userId }),
  ]);
}

export async function onlineCount() {
  try {
    await redis.zremrangebyscore(ONLINE, 0, Date.now() - 45000);
    return await redis.zcard(ONLINE);
  } catch {
    return 0;
  }
}

export function parseMsg(m) {
  if (typeof m === 'string') {
    try {
      return JSON.parse(m);
    } catch {
      return { from: '?', text: m };
    }
  }
  return m;
}
