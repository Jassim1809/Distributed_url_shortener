const { config } = require('../config/env');
const { getRedisClient, getIsRedisConnected } = require('../config/redis');

// In-memory fallback cache when Redis is not configured or unreachable
const fallbackCache = new Map();

async function cacheSet(key, value, ttlSeconds) {
  const redisClient = getRedisClient();
  if (getIsRedisConnected() && redisClient) {
    await redisClient.setex(key, Math.max(1, ttlSeconds), value);
    return;
  }

  fallbackCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

async function cacheGet(key) {
  const redisClient = getRedisClient();
  if (getIsRedisConnected() && redisClient) {
    return await redisClient.get(key);
  }

  const entry = fallbackCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    fallbackCache.delete(key);
    return null;
  }

  return entry.value;
}

async function cacheDel(key) {
  const redisClient = getRedisClient();
  if (getIsRedisConnected() && redisClient) {
    await redisClient.del(key);
    return;
  }

  fallbackCache.delete(key);
}

async function cacheIncr(key) {
  const redisClient = getRedisClient();
  if (getIsRedisConnected() && redisClient) {
    const nextVal = await redisClient.incr(key);
    await redisClient.expire(key, 5);
    return nextVal;
  }

  const current = Number(fallbackCache.get(key)?.value || '0') + 1;
  fallbackCache.set(key, {
    value: String(current),
    expiresAt: Date.now() + 5000,
  });
  return current;
}

async function getNextSequence(workerId = config.workerId) {
  const secondBucket = Math.floor(Date.now() / 1000);
  const counterKey = `seq:${workerId}:${secondBucket}`;
  const count = await cacheIncr(counterKey);
  return count % 4096;
}

module.exports = {
  cacheSet,
  cacheGet,
  cacheDel,
  cacheIncr,
  getNextSequence,
};