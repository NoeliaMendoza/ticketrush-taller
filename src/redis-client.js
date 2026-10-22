const { createClient } = require('redis');

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redis.on('error', (error) => {
  console.error('Error de Redis:', error.message);
});

let connectionPromise;

async function getRedis() {
  if (!connectionPromise) {
    connectionPromise = redis.connect().catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }

  await connectionPromise;
  return redis;
}

module.exports = { getRedis };
