const Redis = require('ioredis');
const { config } = require('./env');

let redisClient = null;
let isRedisConnected = false;

async function connectRedis() {
  if (!config.redisUrl) {
    console.warn('REDIS_URL not set. Running with in-memory cache fallback.');
    return;
  }

  try {
    const isTLS = config.redisUrl.startsWith('rediss://');

    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      lazyConnect: true,
      ...(isTLS ? { tls: { rejectUnauthorized: false } } : {}),
      retryStrategy(times) {
        if (times > 5) return null; // Stop retrying and fall back to memory
        return Math.min(times * 200, 2000);
      },
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      console.warn('Redis connection warning:', err.message);
    });

    await redisClient.connect();
    isRedisConnected = true;
    console.log('Connected to Redis');
  } catch (error) {
    isRedisConnected = false;
    console.warn('Redis unavailable, using in-memory cache fallback.');
  }
}

function getRedisClient() {
  return redisClient;
}

function getIsRedisConnected() {
  return isRedisConnected;
}

module.exports = {
  connectRedis,
  getRedisClient,
  getIsRedisConnected,
};